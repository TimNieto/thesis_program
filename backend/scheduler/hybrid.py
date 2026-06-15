#---------------------------------------------
# backend/scheduler/hybrid.py

import random
import copy
from collections import defaultdict

from scheduler.greedy import generate_schedule as greedy_generate_schedule
from scheduler.greedy import prepare_context, score_employee
from scheduler.constraints import is_valid_candidate


POPULATION_SIZE = 25
GENERATIONS = 30
MUTATION_RATE = 0.35
ELITE_COUNT = 5


def assignment_key(a):
    return (
        a["shift_id"],
        a["role"].lower(),
        a.get("slot_index", 0)
    )

def calculate_unfilled_slots(assignments, shifts, account_settings):
    assigned_counts = defaultdict(int)

    for a in assignments:
        assigned_counts[
            (
                a["shift_id"],
                a["role"].lower()
            )
        ] += 1

    unfilled = []

    for shift in shifts:

        for req in shift.get("staffing_requirements", []):

            role = req["role_key"]
            required_count = req.get("required_count", 0) or 0

            if required_count <= 0:
                continue

            current_count = assigned_counts.get(
                (
                    shift["shift_id"],
                    role.lower()
                ),
                0
            )

            if current_count < required_count:

                for _ in range(required_count - current_count):

                    unfilled.append({
                        "shift_id": shift["shift_id"],
                        "account": shift["account"],
                        "shift_date": str(shift["shift_date"]),
                        "shift_type": shift["shift_type"],
                        "role": role,
                        "reason": f"Missing {role}"
                    })

    return unfilled


def get_day_name(shift_date):
    return shift_date.strftime("%A").lower()


def clamp_int(value, default=50, minimum=0, maximum=100):
    try:
        value = int(value)
    except (TypeError, ValueError):
        value = default

    return max(minimum, min(maximum, value))


def get_absence_tolerance(settings):
    return clamp_int(
        settings.get("absence_tolerance", 50)
        if settings
        else 50
    )


def get_absence_sensitivity(settings):
    tolerance = get_absence_tolerance(settings)

    # 0 tolerance  = 2.0x absence penalty
    # 50 tolerance = 1.0x absence penalty
    # 100 tolerance = 0.0x absence penalty
    return (100 - tolerance) / 50


def get_dynamic_mutation_rate(settings):
    tolerance = get_absence_tolerance(settings)

    # strict absence behavior mutates more often
    # tolerant behavior mutates less often
    return 0.15 + ((100 - tolerance) / 100) * 0.45


def history_key(assignment):
    return (
        assignment["employee_id"],
        assignment["account"].lower(),
        assignment["shift_type"].lower(),
        get_day_name(assignment["shift_date"]),
        assignment["role"].lower()
    )


def historical_score(assignment, history_scores, settings=None):
    data = history_scores.get(
        history_key(assignment),
        {
            "cover_requests": 0,
            "emergency_requests": 0,
            "applications": 0,
            "successful_assignments": 0,
            "absences": 0
        }
    )

    score = 0

    absence_sensitivity = get_absence_sensitivity(settings)

    # repeated cover requests = negative compatibility
    score -= data.get("cover_requests", 0) * 30

    # emergency covers are stronger negative signal
    score -= data.get("emergency_requests", 0) * 60

    # past approved absences are controlled by absence_tolerance
    score -= data.get("absences", 0) * 80 * absence_sensitivity

    # voluntarily applying to similar shift = positive signal
    score += data.get("applications", 0) * 15

    # completed shift without issue = reliability signal
    score += data.get("successful_assignments", 0) * 4

    return score

def remove_overfilled_assignments(assignments, shifts):
    requirement_map = {}

    for shift in shifts:
        for req in shift.get("staffing_requirements", []):
            key = (
                shift["shift_id"],
                req["role_key"].lower()
            )

            requirement_map[key] = req.get("required_count", 0) or 0

    grouped = defaultdict(list)

    for assignment in assignments:
        key = (
            assignment["shift_id"],
            assignment["role"].lower()
        )

        grouped[key].append(assignment)

    cleaned = []

    for key, items in grouped.items():
        required_count = requirement_map.get(key, len(items))

        items = sorted(
            items,
            key=lambda a: a.get("slot_index", 0)
        )

        cleaned.extend(items[:required_count])

    return cleaned


def evaluate_schedule(
    individual,
    history_scores,
    shifts=None,
    account_settings=None,
    settings=None
):
    assignments = individual["assignments"]

    if shifts is not None:
        assignments = remove_overfilled_assignments(assignments, shifts)
        individual["assignments"] = assignments

    if shifts is not None and account_settings is not None:
        unfilled_slots = calculate_unfilled_slots(
            assignments,
            shifts,
            account_settings
        )
        individual["unfilled_slots"] = unfilled_slots
    else:
        unfilled_slots = individual.get("unfilled_slots", [])

    score = 0

    # filled slot reward
    score += len(assignments) * 1000

    # unfilled slot heavy penalty
    score -= len(unfilled_slots) * 10000

    # historical compatibility
    for a in assignments:
        score += historical_score(a, history_scores, settings)

    # fairness
    counts = defaultdict(int)

    for a in assignments:
        counts[a["employee_id"]] += 1

    if counts:
        values = list(counts.values())
        avg = sum(values) / len(values)

        fairness_penalty = sum(
            abs(v - avg)
            for v in values
        )

        score -= fairness_penalty * 50

    individual["fitness"] = score

    return individual


def replay_assignment(context, assignment):
    emp_id = assignment["employee_id"]

    context["assignments"].append(assignment)
    context["assignment_counts"][emp_id] += 1
    context["context_assignments_by_employee"][emp_id].append(assignment)

def reindex_slot_indexes(assignments):
    counters = defaultdict(int)
    cleaned = []

    for assignment in assignments:
        key = (
            assignment["shift_id"],
            assignment["role"].lower()
        )

        updated = copy.deepcopy(assignment)
        updated["slot_index"] = counters[key]

        counters[key] += 1
        cleaned.append(updated)

    return cleaned


def validate_individual_constraints(
    individual,
    employees,
    shifts,
    availability,
    leaves,
    absences,
    settings,
    account_settings,
    history_scores
):
    shift_map = {
        s["shift_id"]: s
        for s in shifts
    }

    context = prepare_context(
        employees,
        shifts,
        availability,
        leaves,
        absences,
        settings,
        account_settings
    )

    context["shift_map"] = shift_map
    context["remaining_shifts"] = shifts.copy()

    valid_assignments = []

    sorted_assignments = sorted(
        individual.get("assignments", []),
        key=lambda a: (
            a.get("shift_id", 0),
            str(a.get("role", "")).lower(),
            a.get("slot_index", 0)
        )
    )

    for assignment in sorted_assignments:
        shift = shift_map.get(assignment["shift_id"])

        if not shift:
            continue

        employee = context["employee_map"].get(
            assignment.get("employee_id")
        )

        if not employee:
            continue

        role = assignment["role"]

        if not is_valid_candidate(
            employee,
            shift,
            role,
            context
        ):
            continue

        cleaned_assignment = copy.deepcopy(assignment)
        cleaned_assignment["shift_date"] = shift["shift_date"]
        cleaned_assignment["shift_type"] = shift["shift_type"]
        cleaned_assignment["account"] = shift["account"]

        replay_assignment(context, cleaned_assignment)
        valid_assignments.append(cleaned_assignment)

    individual["assignments"] = reindex_slot_indexes(valid_assignments)

    return evaluate_schedule(
        individual,
        history_scores,
        shifts,
        account_settings,
        settings
    )


def make_assignment(employee, shift, role, slot_index=0):
    return {
        "shift_id": shift["shift_id"],
        "shift_date": shift["shift_date"],
        "shift_type": shift["shift_type"],
        "account": shift["account"],
        "employee_id": employee["employee_id"],
        "employee_name": employee["full_name"],
        "role": role,
        "slot_index": slot_index,
        "relaxation_level": "ga_optimized"
    }


def mutate_schedule(
    individual,
    employees,
    shifts,
    availability,
    leaves,
    absences,
    settings,
    account_settings,
    history_scores
):
    child = copy.deepcopy(individual)

    if not child["assignments"]:
        return child

    mutation_rate = get_dynamic_mutation_rate(settings)

    if random.random() > mutation_rate:
        return child

    shift_map = {
        s["shift_id"]: s
        for s in shifts
    }

    target = random.choice(child["assignments"])
    target_key = assignment_key(target)

    remaining_assignments = [
        a for a in child["assignments"]
        if assignment_key(a) != target_key
    ]

    context = prepare_context(
        employees,
        shifts,
        availability,
        leaves,
        absences,
        settings,
        account_settings
    )

    context["shift_map"] = shift_map
    context["remaining_shifts"] = shifts.copy()

    for a in remaining_assignments:
        replay_assignment(context, a)

    shift = shift_map[target["shift_id"]]
    role = target["role"]

    if context["context_flags"].get("relax_role"):
        pool = employees
    else:
        pool = context["role_pools"].get(role, [])

    candidates = [
        e for e in pool
        if is_valid_candidate(
            e,
            shift,
            role,
            context
        )
    ]

    if not candidates:
        return child

    def candidate_score(e):
        temp_assignment = make_assignment(
            e,
            shift,
            role,
            target.get("slot_index", 0)
        )

        print(
            "CANDIDATE:",
            e["full_name"],
            "BASE:",
            score_employee(
                e,
                shift,
                role,
                context
            ),
            "HISTORY:",
            historical_score(
            temp_assignment,
            history_scores,
            settings
        )
        )

        return (
            score_employee(
                e,
                shift,
                role,
                context
            )
            + historical_score(
                temp_assignment,
                history_scores,
                settings
            )
        )

    candidates = sorted(
        candidates,
        key=candidate_score,
        reverse=True
    )

    selected = random.choice(
        candidates[:min(5, len(candidates))]
    )

    new_assignment = make_assignment(
        selected,
        shift,
        role,
        target.get("slot_index", 0)
    )

    child["assignments"] = remaining_assignments + [new_assignment]

    return evaluate_schedule(
        child,
        history_scores,
        shifts,
        account_settings,
        settings
    )


def crossover(parent_a, parent_b, history_scores, shifts, account_settings, settings = None):
    child_map = {}

    parent_a_map = {
        assignment_key(a): a
        for a in parent_a["assignments"]
    }

    parent_b_map = {
        assignment_key(a): a
        for a in parent_b["assignments"]
    }

    all_keys = set(parent_a_map.keys()) | set(parent_b_map.keys())

    for key in all_keys:
        source = parent_a_map if random.random() < 0.5 else parent_b_map

        if key in source:
            child_map[key] = copy.deepcopy(source[key])
        elif key in parent_a_map:
            child_map[key] = copy.deepcopy(parent_a_map[key])
        elif key in parent_b_map:
            child_map[key] = copy.deepcopy(parent_b_map[key])

    child = {
        "assignments": list(child_map.values()),
        "unfilled_slots": []
    }

    return evaluate_schedule(
        child,
        history_scores,
        shifts,
        account_settings,
        settings
    )


def tournament_select(population):
    sample = random.sample(
        population,
        min(4, len(population))
    )

    return max(
        sample,
        key=lambda x: x["fitness"]
    )


def generate_schedule(
    employees,
    shifts,
    availability,
    leaves,
    absences,
    settings,
    account_settings,
    history_scores=None
):
    if history_scores is None:
        history_scores = {}

    # 1. greedy seed
    greedy_result = greedy_generate_schedule(
        employees,
        shifts,
        availability,
        leaves,
        absences,
        settings,
        account_settings
    )

    seed = evaluate_schedule(
        {
            "assignments": greedy_result["assignments"],
            "unfilled_slots": greedy_result["unfilled_slots"]
        },
        history_scores,
        shifts,
        account_settings,
        settings
    )

    print("GREEDY SEED ASSIGNMENTS:", len(seed["assignments"]))
    print("GREEDY SEED UNFILLED:", len(seed.get("unfilled_slots", [])))
    print("GREEDY SEED UNFILLED DETAILS:", seed.get("unfilled_slots", []))

    seed = validate_individual_constraints(
        seed,
        employees,
        shifts,
        availability,
        leaves,
        absences,
        settings,
        account_settings,
        history_scores
    )

    population = [seed]

    # 2. generate mutated greedy-based population
    while len(population) < POPULATION_SIZE:
        mutated = mutate_schedule(
            seed,
            employees,
            shifts,
            availability,
            leaves,
            absences,
            settings,
            account_settings,
            history_scores
        )

        mutated = validate_individual_constraints(
            mutated,
            employees,
            shifts,
            availability,
            leaves,
            absences,
            settings,
            account_settings,
            history_scores
        )

        population.append(mutated)

    # 3. evolve
    for _ in range(GENERATIONS):

        population = sorted(
            population,
            key=lambda x: x["fitness"],
            reverse=True
        )

        next_population = population[:ELITE_COUNT]

        while len(next_population) < POPULATION_SIZE:

            parent_a = tournament_select(population)
            parent_b = tournament_select(population)

            child = crossover(
                parent_a,
                parent_b,
                history_scores,
                shifts,
                account_settings,
                settings
            )

            child = validate_individual_constraints(
                child,
                employees,
                shifts,
                availability,
                leaves,
                absences,
                settings,
                account_settings,
                history_scores
            )

            child = mutate_schedule(
                child,
                employees,
                shifts,
                availability,
                leaves,
                absences,
                settings,
                account_settings,
                history_scores
            )

            child = validate_individual_constraints(
                child,
                employees,
                shifts,
                availability,
                leaves,
                absences,
                settings,
                account_settings,
                history_scores
            )

            next_population.append(child)

        population = next_population


    population = [
        validate_individual_constraints(
            individual,
            employees,
            shifts,
            availability,
            leaves,
            absences,
            settings,
            account_settings,
            history_scores
        )
        for individual in population
    ]

    best = max(
        population,
        key=lambda x: x["fitness"]
    )

    if best.get("unfilled_slots") and not seed.get("unfilled_slots"):
        print("GA had unfilled slots. Falling back to greedy seed.")
        best = seed

    print("HYBRID GA RESULT")
    print("BEST FITNESS:", best["fitness"])
    print("ASSIGNMENTS:", len(best["assignments"]))
    print("UNFILLED:", len(best.get("unfilled_slots", [])))
    print("UNFILLED DETAILS:", best.get("unfilled_slots", []))

    return {
        "assignments": best["assignments"],
        "unfilled_slots": best["unfilled_slots"],
        "fitness": best["fitness"]
    }