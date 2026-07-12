import ast
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
APP_ROOT = BACKEND_ROOT / "app"
MODEL_ROOT = APP_ROOT / "models"
TEST_ROOT = BACKEND_ROOT / "tests"

FALLBACK_TOKENS = (
    "LOCAL_DEFAULT_USER_ID",
    "local-default-user",
)

ALLOWED_FALLBACK_FILES = {
    APP_ROOT / "auth" / "current_user.py",
    APP_ROOT / "database_migrations.py",
}

OWNERSHIP_PARAMETER_NAMES = {
    "current_user",
    "user_id",
}


def read_tree(file_path: Path) -> tuple[str, ast.Module]:
    source = file_path.read_text(encoding="utf-8")
    return source, ast.parse(source, filename=str(file_path))


def iter_user_id_fields():
    for model_path in sorted(MODEL_ROOT.glob("*.py")):
        source, tree = read_tree(model_path)

        for node in tree.body:
            if not isinstance(node, ast.ClassDef):
                continue

            for statement in node.body:
                if isinstance(statement, ast.AnnAssign):
                    target = statement.target
                    value = statement.value
                elif isinstance(statement, ast.Assign):
                    if len(statement.targets) != 1:
                        continue

                    target = statement.targets[0]
                    value = statement.value
                else:
                    continue

                if not (
                    isinstance(target, ast.Name)
                    and target.id == "user_id"
                ):
                    continue

                yield (
                    model_path,
                    source,
                    node.name,
                    statement,
                    value,
                )


def get_user_owned_classes() -> set[str]:
    return {
        class_name
        for _, _, class_name, _, _ in iter_user_id_fields()
    }


def get_model_aliases(
    tree: ast.Module,
    user_owned_classes: set[str],
) -> dict[str, str]:
    aliases = {
        class_name: class_name
        for class_name in user_owned_classes
    }

    for node in tree.body:
        if not isinstance(node, ast.ImportFrom):
            continue

        if (
            node.module is None
            or not node.module.startswith("app.models")
        ):
            continue

        for alias in node.names:
            if alias.name not in user_owned_classes:
                continue

            aliases[alias.asname or alias.name] = alias.name

    return aliases


def get_called_model_name(
    node: ast.Call,
    aliases: dict[str, str],
    user_owned_classes: set[str],
) -> str | None:
    if isinstance(node.func, ast.Name):
        return aliases.get(node.func.id)

    if (
        isinstance(node.func, ast.Attribute)
        and node.func.attr in user_owned_classes
    ):
        return node.func.attr

    return None


def get_function_defaults(
    node: ast.FunctionDef | ast.AsyncFunctionDef,
) -> dict[str, ast.expr | None]:
    positional_arguments = [
        *node.args.posonlyargs,
        *node.args.args,
    ]
    defaults_by_name: dict[str, ast.expr | None] = {}

    positional_default_start = (
        len(positional_arguments) - len(node.args.defaults)
    )

    for index, default in enumerate(node.args.defaults):
        argument = positional_arguments[
            positional_default_start + index
        ]
        defaults_by_name[argument.arg] = default

    for argument, default in zip(
        node.args.kwonlyargs,
        node.args.kw_defaults,
        strict=True,
    ):
        if default is not None:
            defaults_by_name[argument.arg] = default

    return defaults_by_name


def format_violations(violations: list[str]) -> str:
    return "\n".join(violations)


def test_user_owned_models_have_no_ownership_defaults():
    fields = list(iter_user_id_fields())

    assert fields, "No user-owned ORM fields were discovered"

    default_violations = []
    fallback_violations = []

    for (
        model_path,
        source,
        class_name,
        statement,
        value,
    ) in fields:
        if any(token in source for token in FALLBACK_TOKENS):
            fallback_violations.append(str(model_path))

        if value is None:
            continue

        for nested_node in ast.walk(value):
            if not isinstance(nested_node, ast.keyword):
                continue

            if nested_node.arg not in {
                "default",
                "server_default",
            }:
                continue

            default_violations.append(
                (
                    f"{model_path}:{statement.lineno}: "
                    f"{class_name}.user_id defines "
                    f"{nested_node.arg}"
                )
            )

    assert not default_violations, format_violations(
        default_violations
    )
    assert not fallback_violations, format_violations(
        fallback_violations
    )


def test_user_owned_model_constructors_require_explicit_user_id():
    user_owned_classes = get_user_owned_classes()
    violations = []

    assert user_owned_classes, (
        "No user-owned ORM classes were discovered"
    )

    for root_name, root_path in (
        ("production", APP_ROOT),
        ("tests", TEST_ROOT),
    ):
        for file_path in sorted(root_path.rglob("*.py")):
            source, tree = read_tree(file_path)
            aliases = get_model_aliases(
                tree,
                user_owned_classes,
            )

            for node in ast.walk(tree):
                if not isinstance(node, ast.Call):
                    continue

                class_name = get_called_model_name(
                    node,
                    aliases,
                    user_owned_classes,
                )

                if class_name is None:
                    continue

                if any(
                    keyword.arg == "user_id"
                    for keyword in node.keywords
                ):
                    continue

                violations.append(
                    (
                        f"{root_name}:"
                        f"{file_path.relative_to(BACKEND_ROOT)}:"
                        f"{node.lineno}: "
                        f"{class_name} omits user_id"
                    )
                )

    assert not violations, format_violations(violations)


def test_repository_and_service_ownership_parameters_are_required():
    violations = []

    for relative_root in (
        Path("repositories"),
        Path("services"),
    ):
        root_path = APP_ROOT / relative_root

        for file_path in sorted(root_path.rglob("*.py")):
            source, tree = read_tree(file_path)

            for node in ast.walk(tree):
                if not isinstance(
                    node,
                    (ast.FunctionDef, ast.AsyncFunctionDef),
                ):
                    continue

                defaults_by_name = get_function_defaults(node)

                for parameter_name in OWNERSHIP_PARAMETER_NAMES:
                    if parameter_name not in defaults_by_name:
                        continue

                    default_node = defaults_by_name[
                        parameter_name
                    ]
                    default_text = ast.get_source_segment(
                        source,
                        default_node,
                    )

                    violations.append(
                        (
                            f"{file_path.relative_to(BACKEND_ROOT)}:"
                            f"{node.lineno}: "
                            f"{node.name} gives "
                            f"{parameter_name} the default "
                            f"{default_text}"
                        )
                    )

    assert not violations, format_violations(violations)


def test_local_default_user_references_stay_inside_approved_boundaries():
    violations = []

    for file_path in sorted(APP_ROOT.rglob("*.py")):
        source = file_path.read_text(encoding="utf-8")

        if not any(
            token in source
            for token in FALLBACK_TOKENS
        ):
            continue

        if file_path in ALLOWED_FALLBACK_FILES:
            continue

        violations.append(
            str(file_path.relative_to(BACKEND_ROOT))
        )

    assert not violations, format_violations(violations)
