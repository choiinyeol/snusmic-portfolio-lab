from __future__ import annotations

import json
from pathlib import Path

from snusmic_pipeline.sim.persona_sim import _load_pit_research_board_personas


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
