import random
import math
from typing import Optional


def sample_random(population: list[dict], size: int, seed: int) -> dict:
    rng = random.Random(seed)
    n = min(size, len(population))
    sample = rng.sample(population, n)
    return {
        "method": "random", "seed": seed,
        "sample_size": len(sample), "population_size": len(population),
        "items": sample, "truncated": len(population) < size,
    }


def sample_stratified(population: list[dict], size: int, seed: int,
                      amount_key: str = "amount_total") -> dict:
    bands: dict[str, list] = {"low": [], "mid": [], "high": []}
    for item in population:
        amt = float(item.get(amount_key) or 0)
        if amt < 10_000:
            bands["low"].append(item)
        elif amt < 100_000:
            bands["mid"].append(item)
        else:
            bands["high"].append(item)

    rng = random.Random(seed)
    sample: list = []
    pop_len = max(len(population), 1)
    for band_items in bands.values():
        n = max(1, round(size * len(band_items) / pop_len))
        sample.extend(rng.sample(band_items, min(n, len(band_items))))

    return {
        "method": "stratified", "seed": seed,
        "sample_size": len(sample[:size]), "population_size": len(population),
        "items": sample[:size], "truncated": len(population) < size,
    }


def sample_mus(population: list[dict], confidence: float,
               tolerable_misstatement: float, seed: int,
               amount_key: str = "amount_total") -> dict:
    total = sum(float(r.get(amount_key) or 0) for r in population)
    if total == 0 or tolerable_misstatement <= 0:
        return sample_random(population, 25, seed)

    # reliability factors for 0 expected errors
    reliability_map = {0.90: 2.31, 0.95: 3.00, 0.99: 4.61}
    rf = reliability_map.get(round(confidence, 2), 3.00)
    sampling_interval = (total * tolerable_misstatement) / rf
    if sampling_interval <= 0:
        return sample_random(population, 25, seed)

    rng = random.Random(seed)
    start = rng.uniform(0, sampling_interval)
    cumulative = 0.0
    sample: list = []
    for item in population:
        amt = float(item.get(amount_key) or 0)
        cumulative += amt
        if cumulative >= start:
            sample.append(item)
            start += sampling_interval

    return {
        "method": "mus", "seed": seed,
        "sample_size": len(sample), "population_size": len(population),
        "items": sample, "truncated": len(population) < 5,
        "sampling_interval": round(sampling_interval, 2),
        "reliability_factor": rf,
    }


def sample_judgmental(population: list[dict], ids: list[int],
                      id_key: str = "id") -> dict:
    id_set = set(ids)
    sample = [r for r in population if r.get(id_key) in id_set]
    return {
        "method": "judgmental", "seed": 0,
        "sample_size": len(sample), "population_size": len(population),
        "items": sample, "truncated": False,
    }


def run_sampling(population: list[dict], method: str, target_size: int,
                 seed: int, confidence: float, tolerable_misstatement: float,
                 judgmental_ids: list[int]) -> dict:
    if method == "random":
        return sample_random(population, target_size, seed)
    elif method == "stratified":
        return sample_stratified(population, target_size, seed)
    elif method == "mus":
        return sample_mus(population, confidence, tolerable_misstatement, seed)
    elif method == "judgmental":
        return sample_judgmental(population, judgmental_ids)
    else:
        raise ValueError(f"Unknown sampling method: {method}")
