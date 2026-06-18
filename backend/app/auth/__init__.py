"""Authentication and user-context helpers.

This package is intentionally small for now. The app still uses the local
access token gate in main.py, and this module only introduces a local current
user concept so services can later become user-scoped without a large rewrite.
"""
