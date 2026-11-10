import threading
from typing import Dict, List, Optional
from app.schemas.paypal import TransactionRecord


class TransactionStore:
    """Thread-safe in-memory store for PayPilot transactions."""

    def __init__(self):
        self._lock = threading.Lock()
        self._transactions: Dict[str, TransactionRecord] = {}

    def save(self, record: TransactionRecord) -> None:
        with self._lock:
            self._transactions[record.order_id] = record

    def get(self, order_id: str) -> Optional[TransactionRecord]:
        with self._lock:
            return self._transactions.get(order_id)

    def list_all(self, limit: int = 50) -> List[TransactionRecord]:
        with self._lock:
            # Sort newest first
            records = list(self._transactions.values())
            records.sort(key=lambda r: r.created_at, reverse=True)
            return records[:limit]


# Global singleton instance
transaction_store = TransactionStore()
