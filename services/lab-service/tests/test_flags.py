from decimal import Decimal as D

import pytest

from app.services.flags import compute_flag, format_range

HGB = (D("12.0"), D("17.0"), D("7.0"), D("20.0"))
WBC = (D("4.0"), D("11.0"), D("2.0"), D("30.0"))
K = (D("3.5"), D("5.1"), D("2.5"), D("6.5"))
CHOL = (D("0"), D("200"), None, None)


@pytest.mark.parametrize(
    "value, limits, expected",
    [
        (D("14.2"), HGB, "NORMAL"),
        (D("11.0"), HGB, "LOW"),
        (D("6.5"), HGB, "CRITICAL"),
        (D("12.5"), WBC, "HIGH"),
        (D("6.8"), K, "CRITICAL"),
        (D("230"), CHOL, "HIGH"),
    ],
)
def test_spec_examples(value, limits, expected):
    assert compute_flag(value, *limits) == expected


def test_boundaries_are_normal():
    assert compute_flag(D("12.0"), *HGB) == "NORMAL"
    assert compute_flag(D("17.0"), *HGB) == "NORMAL"


def test_critical_boundaries_are_not_critical():
    assert compute_flag(D("7.0"), *HGB) == "LOW"
    assert compute_flag(D("20.0"), *HGB) == "HIGH"


def test_no_critical_limits_never_critical():
    assert compute_flag(D("100000"), *CHOL) == "HIGH"


def test_format_range():
    assert format_range(D("12.0"), D("17.0")) == "12.0-17.0"