from typing import Optional
from pydantic import BaseModel, Field


class ParseIntentRequest(BaseModel):
    """Payload to parse natural language payment intent."""

    prompt: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="User natural-language payment request",
        examples=["Pay $25 for autonomous cloud inference tokens"],
    )


class ParseIntentResponse(BaseModel):
    """Structured response from the AI payment intent parser."""

    amount: Optional[str] = Field(
        default=None,
        description="Validated positive payment amount formatted to 2 decimal places (e.g. '10.00')",
        examples=["10.00"],
    )
    currency: Optional[str] = Field(
        default=None,
        description="Supported 3-letter ISO-4217 currency code (e.g. 'USD')",
        examples=["USD"],
    )
    description: Optional[str] = Field(
        default=None,
        description="Clean, concise payment description (max 127 chars for PayPal purchase unit)",
        examples=["Autonomous cloud inference tokens"],
    )
    intent: str = Field(
        default="Payment Request",
        description="Detected intent category or summary",
        examples=["Compute Credits"],
    )
    needs_clarification: bool = Field(
        default=False,
        description="Flag indicating if amount or currency is missing or ambiguous",
    )
    clarification_question: Optional[str] = Field(
        default=None,
        description="Question to ask the user if clarification is required",
    )
    explanation: str = Field(
        default="",
        description="Short human-readable summary of what was extracted",
        examples=["Extracted $10.00 USD for cloud inference tokens."],
    )

