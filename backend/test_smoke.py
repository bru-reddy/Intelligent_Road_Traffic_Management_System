from app.models.user import User


def test_import():
    from app.main import app

    assert app.title == "Intelligent Road Traffic Monitoring System (IRTMS)"


def test_public_commissioner_registration_rejected():
    from app.core.database import SessionLocal
    from app.modules.user_management.service import register

    db = SessionLocal()

    email = "commissioner.public@test.local"

    try:
        db.query(User).filter(User.email == email).delete()
        db.commit()

        try:
            register(
                db=db,
                full_name="Public Commissioner",
                email=email,
                password="Commissioner@123",
                role="commissioner",
            )

            assert False, "Privileged roles should not be self-assigned"

        except ValueError as exc:
            assert "Privileged roles cannot be self-assigned" in str(exc)

    finally:
        db.query(User).filter(User.email == email).delete()
        db.commit()
        db.close()