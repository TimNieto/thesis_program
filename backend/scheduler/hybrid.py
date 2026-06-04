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
        a["role"],
        a["employee_id"]
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
        account_policy = account_settings.get(
            shift["account"],
            {}
        )

        operator_policy = account_policy.get(
            "operator_policy",
            "required"
        )

        for req in shift.get("staffing_requirements", []):

            role = req["role_key"]
            required_count = req.get("required_count", 0) or 0

            if required_count <= 0:
                continue

            if role == "operator" and operator_policy == "avoid":
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


def history_key(assignment):
    return (
        assignment["employee_id"],
        assignment["account"].lower(),
        assignment["shift_type"].lower(),
        get_day_name(assignment["shift_date"]),
        assignment["role"].lower()
    )


def historical_score(assignment, history_scores):
    data = history_scores.get(
        history_key(assignment),
        {
            "cover_requests": 0,
            "emergency_requests": 0,
            "applications": 0,
            "successful_assignments": 0
        }
    )

    score = 0

    # repeated cover requests = negative compatibility
    score -= data["cover_requests"] * 30

    # emergency covers are stronger negative signal
    score -= data["emergency_requests"] * 60

    # voluntarily applying to similar shift = positive signal
    score += data["applications"] * 15

    # completed shift without cover request = small reliability signal
    score += data["successful_assignments"] * 4

    return score


def evaluate_schedule(individual, history_scores, shifts=None, account_settings=None):
    assignments = individual["assignments"]

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
        score += historical_score(a, history_scores)

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

    if random.random() > MUTATION_RATE:
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
                history_scores
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
                history_scores
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
        account_settings
    )


def crossover(parent_a, parent_b, history_scores, shifts, account_settings):
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
        account_settings
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
        account_settings
    )

    print("GREEDY SEED ASSIGNMENTS:", len(seed["assignments"]))
    print("GREEDY SEED UNFILLED:", len(seed.get("unfilled_slots", [])))
    print("GREEDY SEED UNFILLED DETAILS:", seed.get("unfilled_slots", []))

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
                account_settings
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

            next_population.append(child)

        population = next_population

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