from datetime import UTC, date, datetime, timedelta
from decimal import Decimal, InvalidOperation

from app.services.market_data.base import (
    MarketDataHistoryPoint,
    MarketDataLatestPrice,
    MarketDataProviderError,
)


class YFinanceMarketDataProvider:
    source_name = "yfinance"

    def get_latest_price(self, symbol: str) -> MarketDataLatestPrice:
        yf = self._import_yfinance()
        ticker = yf.Ticker(symbol)

        currency = self._get_currency(ticker)

        price = self._get_fast_latest_price(ticker)

        if price is None:
            history = ticker.history(period="5d", interval="1d", auto_adjust=False)

            if history.empty or "Close" not in history:
                raise MarketDataProviderError(f"No latest price found for {symbol}")

            price = self._to_decimal(history["Close"].dropna().iloc[-1])

        return MarketDataLatestPrice(
            price=price,
            currency=currency,
            fetched_at=datetime.now(UTC),
        )

    def get_history(
        self,
        symbol: str,
        date_from: date,
        date_to: date,
    ) -> list[MarketDataHistoryPoint]:
        yf = self._import_yfinance()
        ticker = yf.Ticker(symbol)

        currency = self._get_currency(ticker)
        exclusive_end = date_to + timedelta(days=1)
        history = ticker.history(
            start=date_from.isoformat(),
            end=exclusive_end.isoformat(),
            interval="1d",
            auto_adjust=False,
        )

        if history.empty or "Close" not in history:
            raise MarketDataProviderError(f"No historical prices found for {symbol}")

        points: list[MarketDataHistoryPoint] = []

        for index, row in history.iterrows():
            close_price = row.get("Close")

            if close_price is None:
                continue

            try:
                price = self._to_decimal(close_price)
            except MarketDataProviderError:
                continue

            points.append(
                MarketDataHistoryPoint(
                    price_date=index.date(),
                    close_price=price,
                    currency=currency,
                )
            )

        if not points:
            raise MarketDataProviderError(f"No usable historical prices found for {symbol}")

        return points

    def _import_yfinance(self):
        try:
            import yfinance as yf
        except ImportError as error:
            raise MarketDataProviderError(
                "yfinance is not installed. Install backend requirements first."
            ) from error

        return yf

    def _get_currency(self, ticker) -> str:
        try:
            currency = ticker.fast_info.get("currency")
        except Exception:
            currency = None

        if not currency:
            try:
                currency = ticker.info.get("currency")
            except Exception:
                currency = None

        return str(currency or "USD").upper()[:3]

    def _get_fast_latest_price(self, ticker) -> Decimal | None:
        for attribute_name in ("last_price", "regular_market_price", "previous_close"):
            try:
                value = getattr(ticker.fast_info, attribute_name)
            except Exception:
                value = None

            if value is None:
                continue

            return self._to_decimal(value)

        return None

    def _to_decimal(self, value) -> Decimal:
        try:
            price = Decimal(str(value))
        except (InvalidOperation, ValueError) as error:
            raise MarketDataProviderError("Invalid price returned by market data provider") from error

        if price <= 0:
            raise MarketDataProviderError("Non-positive price returned by market data provider")

        return price
