from decimal import Decimal


def compute_flag(
    value: Decimal,
    ref_low: Decimal,
    ref_high: Decimal,
    critical_low: Decimal | None,
    critical_high: Decimal | None,
) -> str:
    # Les valeurs critiques sont testées en premier
    if critical_low is not None and value < critical_low:
        return "CRITICAL"
    if critical_high is not None and value > critical_high:
        return "CRITICAL"
    if value < ref_low:
        return "LOW"
    if value > ref_high:
        return "HIGH"
    return "NORMAL"


def format_range(ref_low: Decimal, ref_high: Decimal) -> str:
    # "refLow-refHigh" avec une décimale, par exemple 12.0-17.0
    return f"{ref_low:.1f}-{ref_high:.1f}"