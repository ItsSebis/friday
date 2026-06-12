"""Domain: Streaming-Events des Agenten.

Der ``AgentPort`` streamt während der Verarbeitung diese Events. So bleibt der
Port framework-frei (er kennt weder WebSocket noch Hermes-SSE), und der
``SessionService`` übersetzt die Events in das WebSocket-Protokoll.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class TextDelta:
    """Ein Stück generierter Antworttext."""

    text: str


@dataclass(frozen=True)
class ToolProgress:
    """Statusmeldung zu einem Tool-Aufruf des Agenten."""

    tool: str
    status: str  # "started" | "succeeded" | "failed"
    detail: dict = field(default_factory=dict)


# Union aller Event-Typen, die der Agent streamen kann.
AgentEvent = TextDelta | ToolProgress
