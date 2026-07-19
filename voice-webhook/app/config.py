"""Runtime configuration, loaded from environment variables.

Every knob has a safe default so the service can boot in test and CI without
secrets. Real deployments must supply SUPABASE_* and ANTHROPIC_API_KEY.
"""
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # ── Supabase ──────────────────────────────────────────────────────────
    supabase_url: str = Field(default="", alias="SUPABASE_URL")
    # Service role key: the backend runs server-side and bypasses RLS. Never
    # ships to the browser.
    supabase_service_role_key: str = Field(
        default="", alias="SUPABASE_SERVICE_ROLE_KEY"
    )
    # Name of the transactional ingest function created by the SQL migration.
    ingest_rpc: str = Field(default="lalum_ingest_call", alias="INGEST_RPC")
    unprocessed_view: str = Field(
        default="lalum_calls_meta", alias="UNPROCESSED_TABLE"
    )

    # ── Anthropic / Claude ────────────────────────────────────────────────
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    anthropic_model: str = Field(
        default="claude-3-5-sonnet-latest", alias="ANTHROPIC_MODEL"
    )
    anthropic_max_tokens: int = Field(default=1024, alias="ANTHROPIC_MAX_TOKENS")
    anthropic_timeout_seconds: float = Field(
        default=30.0, alias="ANTHROPIC_TIMEOUT_SECONDS"
    )

    # ── Billing ───────────────────────────────────────────────────────────
    # Standard NET hourly rate (before VAT) applied to billable calls.
    standard_hourly_rate: float = Field(
        default=1000.0, alias="STANDARD_HOURLY_RATE"
    )
    # VAT rate added on top of the net fee (Israel: 18%).
    billing_vat_rate: float = Field(default=0.18, alias="BILLING_VAT_RATE")
    billing_currency: str = Field(default="ILS", alias="BILLING_CURRENCY")
    # Round call time up to this increment (minutes) before billing.
    billing_increment_minutes: int = Field(
        default=15, alias="BILLING_INCREMENT_MINUTES"
    )

    # ── HTTP ──────────────────────────────────────────────────────────────
    http_timeout_seconds: float = Field(default=15.0, alias="HTTP_TIMEOUT_SECONDS")

    # Optional shared secret for the platform webhooks. When set, an inbound
    # Vapi/Retell webhook must present it in the x-vapi-secret or
    # x-webhook-secret header, otherwise the request is rejected.
    voice_webhook_secret: str = Field(default="", alias="VOICE_WEBHOOK_SECRET")


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton (safe to import anywhere)."""
    return Settings()
