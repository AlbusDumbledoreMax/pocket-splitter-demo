from settlement import net_transactions, compute_net_balances
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship
from pydantic import BaseModel
from datetime import datetime
from typing import List, Dict
import random, string
import io
import csv
from pathlib import Path
import json

app = FastAPI()

origins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # TEMP: allow everything
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = create_engine("sqlite:///./pocket.db")
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


# Models
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    groups = relationship("GroupMember", back_populates="user")


class Group(Base):
    __tablename__ = "groups"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    invite_code = Column(String, unique=True)
    members = relationship("GroupMember", back_populates="group")
    expenses = relationship("Expense", back_populates="group")


class GroupMember(Base):
    __tablename__ = "group_members"
    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    group = relationship("Group", back_populates="members")
    user = relationship("User", back_populates="groups")


class Expense(Base):
    __tablename__ = "expenses"
    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"))
    paid_by = Column(Integer, ForeignKey("users.id"))
    amount = Column(Float)
    description = Column(String)
    receipt_url = Column(String, nullable=True)  # image path
    splits = relationship("Split", back_populates="expense")
    group = relationship("Group")


class Split(Base):
    __tablename__ = "splits"
    id = Column(Integer, primary_key=True)
    expense_id = Column(Integer, ForeignKey("expenses.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    share = Column(Float)
    expense = relationship("Expense")


class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"))
    from_user = Column(Integer, ForeignKey("users.id"))
    to_user = Column(Integer, ForeignKey("users.id"))
    amount = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(engine)


# Pydantic models
class GroupCreate(BaseModel):
    name: str


class ExpenseCreate(BaseModel):
    paid_by: int
    amount: float
    description: str
    splits: List[dict]  # [{"user_id": 1, "share": 0.4}, ...]


class Balances(BaseModel):
    user_id: int
    name: str
    balance: float


class JoinGroupRequest(BaseModel):
    invite_code: str
    email: str
    name: str


# Calculator models
class CalcPerson(BaseModel):
    user_id: int
    name: str
    paid: float
    share: float  # ratio weight, e.g. 1,2,3 or 0 if equal split


class CalcRequest(BaseModel):
    total_amount: float
    equal_split: bool
    people: List[CalcPerson]


class CalcResult(BaseModel):
    fair_shares: Dict[int, float]
    net: Dict[int, float]
    transactions: List[Dict[str, float]]


# Deps
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Seed demo data (idempotent, no UNIQUE issues)
def seed_demo():
    db = SessionLocal()
    try:
        existing_group = db.query(Group).filter_by(invite_code="DEMO123").first()
        if existing_group:
            return

        alice = db.query(User).filter_by(email="alice@test.com").first()
        bob = db.query(User).filter_by(email="bob@test.com").first()
        charlie = db.query(User).filter_by(email="charlie@test.com").first()

        if not alice:
            alice = User(email="alice@test.com", name="Alice")
            db.add(alice)
        if not bob:
            bob = User(email="bob@test.com", name="Bob")
            db.add(bob)
        if not charlie:
            charlie = User(email="charlie@test.com", name="Charlie")
            db.add(charlie)

        db.flush()

        group = Group(name="Roommates", invite_code="DEMO123")
        db.add(group)
        db.flush()

        for u in [alice, bob, charlie]:
            exists_member = (
                db.query(GroupMember)
                .filter_by(group_id=group.id, user_id=u.id)
                .first()
            )
            if not exists_member:
                db.add(GroupMember(group_id=group.id, user_id=u.id))

        db.commit()
    finally:
        db.close()


# Seed demo when module is imported (so it works with uvicorn main:app)
seed_demo()


# Routes
@app.get("/")
def root():
    return {"message": "Pocket Splitter API", "demo_group": "/group/DEMO123"}


@app.post("/group")
def create_group(group: GroupCreate, db: Session = Depends(get_db)):
    invite_code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    new_group = Group(name=group.name, invite_code=invite_code)
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    return new_group


@app.get("/group/{invite_code}")
def get_group(invite_code: str, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.invite_code == invite_code).first()
    if not group:
        raise HTTPException(404, "Group not found")
    return {
        "id": group.id,
        "name": group.name,
        "invite_code": group.invite_code,
        "members": [{"id": m.user.id, "name": m.user.name} for m in group.members],
    }


@app.post("/group/join")
def join_group(req: JoinGroupRequest, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.invite_code == req.invite_code).first()
    if not group:
        raise HTTPException(404, "Group not found")

    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        user = User(email=req.email, name=req.name)
        db.add(user)
        db.flush()

    exists = (
        db.query(GroupMember)
        .filter_by(group_id=group.id, user_id=user.id)
        .first()
    )
    if not exists:
        db.add(GroupMember(group_id=group.id, user_id=user.id))

    db.commit()
    return {
        "group_id": group.id,
        "group_name": group.name,
        "invite_code": group.invite_code,
        "user_id": user.id,
        "user_name": user.name,
    }


@app.post("/group/{group_id}/expense")
def add_expense(group_id: int, expense: ExpenseCreate, db: Session = Depends(get_db)):
    total_split = sum(s["share"] for s in expense.splits)
    if abs(total_split - 1.0) > 0.01:
        raise HTTPException(400, "Splits must total 100%")

    new_expense = Expense(
        group_id=group_id,
        paid_by=expense.paid_by,
        amount=expense.amount,
        description=expense.description,
    )
    db.add(new_expense)
    db.flush()

    for split in expense.splits:
        s = Split(
            expense_id=new_expense.id,
            user_id=split["user_id"],
            share=split["share"],
        )
        db.add(s)

    db.commit()
    return {"id": new_expense.id}


# Expense with image upload
@app.post("/group/{group_id}/expense-with-receipt")
async def add_expense_with_receipt(
    group_id: int,
    paid_by: int = Form(...),
    amount: float = Form(...),
    description: str = Form(""),
    splits: str = Form(...),  # JSON string: [{"user_id":..,"share":..},...]
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    splits_data = json.loads(splits)

    filename = f"{datetime.utcnow().timestamp()}_{file.filename}"
    filepath = UPLOAD_DIR / filename
    with open(filepath, "wb") as f:
        f.write(await file.read())

    new_expense = Expense(
        group_id=group_id,
        paid_by=paid_by,
        amount=amount,
        description=description,
        receipt_url=str(filepath),
    )
    db.add(new_expense)
    db.flush()

    for split in splits_data:
        s = Split(
            expense_id=new_expense.id,
            user_id=split["user_id"],
            share=split["share"],
        )
        db.add(s)

    db.commit()
    return {"id": new_expense.id, "receipt_url": new_expense.receipt_url}


@app.get("/group/{group_id}/balances")
def get_balances(group_id: int, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(404)

    members = {m.user.id: m.user.name for m in group.members}
    balances = {uid: 0.0 for uid in members.keys()}

    for expense in group.expenses:
        # everyone owes their share
        for split in expense.splits:
            owed = expense.amount * split.share
            balances[split.user_id] -= owed
        # payer paid full amount
        balances[expense.paid_by] += expense.amount

    return [
        {"user_id": uid, "name": name, "balance": balances.get(uid, 0.0)}
        for uid, name in members.items()
    ]


@app.get("/group/{group_id}/settlements/suggested")
def suggested_settlements(group_id: int, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(404)

    members = {m.user.id: m.user.name for m in group.members}
    balances = {uid: 0.0 for uid in members.keys()}

    for expense in group.expenses:
        for split in expense.splits:
            owed = expense.amount * split.share
            balances[split.user_id] -= owed
        balances[expense.paid_by] += expense.amount

    transactions = net_transactions(balances)

    enriched = [
        {
            "from_user": tx["from_user"],
            "from_name": members.get(tx["from_user"]),
            "to_user": tx["to_user"],
            "to_name": members.get(tx["to_user"]),
            "amount": tx["amount"],
        }
        for tx in transactions
    ]

    return {"transactions": enriched}


@app.post("/group/{group_id}/settle")
def settle_up(group_id: int, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(404, "Group not found")

    members = {m.user.id: m.user.name for m in group.members}
    balances = {uid: 0.0 for uid in members.keys()}

    # 1) Compute current balances from expenses
    for expense in group.expenses:
        for split in expense.splits:
            owed = expense.amount * split.share
            balances[split.user_id] -= owed
        balances[expense.paid_by] += expense.amount

    # 2) Compute suggested transactions to settle these balances
    transactions = net_transactions(balances)

    # 3) Record transactions + create settlement expenses that cancel the balances
    for tx in transactions:
        from_user = tx["from_user"]
        to_user = tx["to_user"]
        amount = tx["amount"]

        # Audit log transaction
        t = Transaction(
            group_id=group_id,
            from_user=from_user,
            to_user=to_user,
            amount=amount,
        )
        db.add(t)

        # Create a "settlement" expense that cancels this debt
        settlement_expense = Expense(
            group_id=group_id,
            paid_by=from_user,
            amount=amount,
            description="Settlement",
            receipt_url=None,
        )
        db.add(settlement_expense)
        db.flush()

        # In this expense, to_user is the only one who "owes" the full amount
        split_to = Split(
            expense_id=settlement_expense.id,
            user_id=to_user,
            share=1.0,
        )
        db.add(split_to)

    db.commit()

    return {
        "transactions": transactions,
        "message": f"Settled {len(transactions)} transactions and recorded settlement expenses",
    }


@app.get("/group/{group_id}/activity")
def group_activity(group_id: int, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(404)

    members = {m.user.id: m.user.name for m in group.members}

    expenses_data = []
    for e in group.expenses:
        splits = [
            {
                "user_id": s.user_id,
                "user_name": members.get(s.user_id),
                "share": s.share,
                "amount": e.amount * s.share,
            }
            for s in e.splits
        ]
        expenses_data.append(
            {
                "id": e.id,
                "type": "expense",
                "description": e.description,
                "amount": e.amount,
                "paid_by": e.paid_by,
                "paid_by_name": members.get(e.paid_by),
                "splits": splits,
                "receipt_url": e.receipt_url,
            }
        )

    txs = (
        db.query(Transaction)
        .filter(Transaction.group_id == group_id)
        .order_by(Transaction.timestamp)
        .all()
    )
    settlements_data = [
        {
            "id": t.id,
            "type": "settlement",
            "from_user": t.from_user,
            "from_name": members.get(t.from_user),
            "to_user": t.to_user,
            "to_name": members.get(t.to_user),
            "amount": t.amount,
            "timestamp": t.timestamp,
        }
        for t in txs
    ]

    return {
        "expenses": expenses_data,
        "settlements": settlements_data,
    }


@app.get("/group/{group_id}/transactions.csv")
def export_transactions_csv(group_id: int, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(404)

    txs = (
        db.query(Transaction)
        .filter(Transaction.group_id == group_id)
        .order_by(Transaction.timestamp)
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["timestamp", "from_user", "to_user", "amount"])

    for t in txs:
        writer.writerow([t.timestamp.isoformat(), t.from_user, t.to_user, t.amount])

    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="group_{group_id}_transactions.csv"'
        },
    )


@app.post("/calc/settle", response_model=CalcResult)
def calc_settle(req: CalcRequest):
    n = len(req.people)
    if n == 0:
        raise HTTPException(400, "Need at least one person")

    paid = {p.user_id: p.paid for p in req.people}

    if req.equal_split:
        shares = {p.user_id: 1.0 for p in req.people}
    else:
        if all(p.share <= 0 for p in req.people):
            raise HTTPException(400, "Non-equal split needs positive share weights")
        shares = {p.user_id: p.share for p in req.people}

    net = compute_net_balances(req.total_amount, paid, shares)

    total_shares = sum(shares.values())
    fair_shares = {
        p.user_id: req.total_amount * (shares[p.user_id] / total_shares)
        for p in req.people
    }

    transactions = net_transactions(net)

    return {
        "fair_shares": fair_shares,
        "net": net,
        "transactions": transactions,
    }


if __name__ == "__main__":
    import uvicorn
    # optional: seed here too if you ever run python main.py directly
    # seed_demo()
    uvicorn.run(app, host="0.0.0.0", port=8000)