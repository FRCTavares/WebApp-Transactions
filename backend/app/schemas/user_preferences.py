from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


SUPPORTED_LOCALES = {"en-GB", "pt-PT"}
SUPPORTED_LANGUAGES = {"en", "pt"}
SUPPORTED_DATE_FORMATS = {"short", "medium", "long"}


class UserPreferencesUpdate(BaseModel):
    locale: str
    currency: str = Field(min_length=3, max_length=3)
    time_zone: str = Field(min_length=1, max_length=64)
    date_format: str
    language: str
    monthly_investment_goal_eur: Decimal | None = Field(
        default=None,
        gt=0,
    )

    @field_validator("locale")
    @classmethod
    def validate_locale(cls, value: str) -> str:
        if value not in SUPPORTED_LOCALES:
            raise ValueError("unsupported locale")
        return value

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        if value not in SUPPORTED_LANGUAGES:
            raise ValueError("unsupported language")
        return value

    @field_validator("date_format")
    @classmethod
    def validate_date_format(cls, value: str) -> str:
        if value not in SUPPORTED_DATE_FORMATS:
            raise ValueError("unsupported date format")
        return value

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        normalized = value.upper()
        if not normalized.isascii() or not normalized.isalpha():
            raise ValueError("currency must be a three-letter ISO 4217 code")
        return normalized

    @field_validator("time_zone")
    @classmethod
    def validate_time_zone(cls, value: str) -> str:
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as error:
            raise ValueError("unsupported time zone") from error
        return value


class UserPreferencesRead(UserPreferencesUpdate):
    model_config = ConfigDict(from_attributes=True)

    monthly_investment_goal_eur: Decimal = Field(gt=0)
