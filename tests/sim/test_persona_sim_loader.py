from __future__ import annotations

import json
import runpy
from collections.abc import Callable
from pathlib import Path
from typing import cast

from snusmic_pipeline.sim.contracts import PitResearchBoardConfig

_SCRIPT_PATH = Path(__file__).resolve().parents[2] / "scripts" / "run_persona_sim.py"
_SCRIPT_HELPERS = runpy.run_path(str(_SCRIPT_PATH))
_load_pit_research_board_personas = cast(
    Callable[[Path], tuple[PitResearchBoardConfig, ...]],
    _SCRIPT_HELPERS["_load_pit_research_board_personas"],
)


def test_persona_sim_loader_excludes_experimental_pit_alpha_personas(tmp_path: Path) -> None:
    path = tmp_path / "pit-personas.json"
    path.write_text(
        json.dumps(
            [
                {
                    "persona_name": "pit_research_board_score_top5",
                    "label": "PIT Score",
                    "top_n": 5,
                },
                {
                    "persona_name": "pit_research_board_alpha_top1",
                    "label": "PIT Alpha",
                    "top_n": 3,
                },
            ]
        ),
        encoding="utf-8",
    )

    personas = _load_pit_research_board_personas(path)

    assert [persona.persona_name for persona in personas] == ["pit_research_board_score_top5"]
