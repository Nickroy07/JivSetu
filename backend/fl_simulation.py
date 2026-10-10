import random
from dataclasses import dataclass

@dataclass
class HospitalUpdate:
    hospital_id: str
    weights: list[float]

def local_training(hospital_id: str, base_weights: list[float]) -> HospitalUpdate:
    return HospitalUpdate(hospital_id, [w + random.uniform(-0.05, 0.05) for w in base_weights])

def secure_aggregate(updates: list[HospitalUpdate]) -> list[float]:
    if not updates:
        raise ValueError("No hospital updates provided.")
    return [
        sum(update.weights[i] for update in updates) / len(updates)
        for i in range(len(updates[0].weights))
    ]

if __name__ == "__main__":
    global_model = [0.20, 0.40, 0.60, 0.80]
    hospitals = ["JANSEVA-A", "JANSEVA-B", "JANSEVA-C"]
    updates = [local_training(h, global_model) for h in hospitals]
    print("Federated Learning Simulation")
    print("Raw patient data exchanged: NO")
    print("Hospital updates:", len(updates))
    print("Global model:", secure_aggregate(updates))
