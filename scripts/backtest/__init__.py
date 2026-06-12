# -*- coding: utf-8 -*-
from __future__ import annotations

"""backtest 패키지 — backtest_momentum.py 모놀리스를 모듈로 분할 (순수 이동).

서브모듈의 공개 이름을 패키지 레벨로 재노출한다.
"""

from .config import *  # noqa: F401,F403
from .fx import *  # noqa: F401,F403
from .warehouse import *  # noqa: F401,F403
from .accounting import *  # noqa: F401,F403
from .metrics import *  # noqa: F401,F403
from .strategies import *  # noqa: F401,F403
from .reporting import *  # noqa: F401,F403

from . import config, fx, warehouse, accounting, metrics, strategies, reporting  # noqa: F401

# Re-export underscore-prefixed names that `import *` skips, so callers that
# referenced backtest_momentum._private get them via the package too.
for _m in (config, fx, warehouse, accounting, metrics, strategies, reporting):
    for _k, _v in vars(_m).items():
        if _k.startswith('_') and not _k.startswith('__'):
            globals()[_k] = _v
del _m, _k, _v
