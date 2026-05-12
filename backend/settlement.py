# settlement.py
from typing import Dict, List, Tuple

def compute_net_balances(
    total_amount: float,
    paid: Dict[int, float],
    shares: Dict[int, float],
) -> Dict[int, float]:
    """
    total_amount: total expense amount (e.g. 1200)
    paid: {user_id: amount_paid}
    shares: {user_id: weight or ratio part, e.g. 1,2,3,4 or 0.1,0.2,...}

    Returns: net balance per user_id (paid - fair_share).
    Positive => user is owed; Negative => user owes.
    """
    total_shares = sum(shares.values())
    fair: Dict[int, float] = {}

    for user_id, weight in shares.items():
        fair_share = total_amount * (weight / total_shares)
        fair[user_id] = fair.get(user_id, 0.0) + fair_share

    net: Dict[int, float] = {}
    for user_id in set(list(paid.keys()) + list(fair.keys())):
        net[user_id] = paid.get(user_id, 0.0) - fair.get(user_id, 0.0)

    return net


def net_transactions(net: Dict[int, float]) -> List[Dict[str, float]]:
    """
    net: {user_id: net_balance}
    Returns: list of transactions {"from_user": id, "to_user": id, "amount": x}
    implementing the netting algorithm for any number of people.
    """
    creditors: List[List[float]] = []  # [user_id, amount > 0]
    debtors: List[List[float]] = []    # [user_id, amount < 0]

    for user_id, balance in net.items():
        if balance > 0.01:
            creditors.append([user_id, balance])
        elif balance < -0.01:
            debtors.append([user_id, balance])

    transactions: List[Dict[str, float]] = []
    i, j = 0, 0

    while i < len(creditors) and j < len(debtors):
        cred_id, cred_amt = creditors[i]
        debt_id, debt_amt = debtors[j]

        transfer = min(cred_amt, -debt_amt)

        transactions.append({
            "from_user": debt_id,
            "to_user": cred_id,
            "amount": transfer
        })

        creditors[i][1] -= transfer
        debtors[j][1] += transfer

        if abs(creditors[i][1]) < 0.01:
            i += 1
        if abs(debtors[j][1]) < 0.01:
            j += 1

    return transactions