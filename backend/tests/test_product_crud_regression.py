import os
import uuid

import pytest
import requests


BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


@pytest.fixture
def admin_session():
    session = requests.Session()
    login = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "admin"},
    )
    assert login.status_code == 200
    assert login.json()["role"] == "admin"
    assert session.cookies.get("access_token")
    return session


def test_login_rejects_invalid_credentials():
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert "detail" in response.json()


def test_product_create_update_delete_and_pos_visibility(admin_session):
    name = f"TEST_CRUD_{uuid.uuid4().hex[:8]}"
    created = admin_session.post(
        f"{BASE_URL}/api/products", json={"name": name, "price": 12000}
    )
    assert created.status_code == 200
    product = created.json()
    assert product["name"] == name
    assert product["price"] == 12000
    product_id = product["id"]

    listed = admin_session.get(f"{BASE_URL}/api/products")
    assert listed.status_code == 200
    assert any(item["id"] == product_id for item in listed.json())

    renamed = f"{name}_RENAMED"
    updated = admin_session.put(
        f"{BASE_URL}/api/products/{product_id}",
        json={"name": renamed, "price": 13500},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == renamed
    assert updated.json()["price"] == 13500

    listed_after_update = admin_session.get(f"{BASE_URL}/api/products")
    assert any(
        item["id"] == product_id
        and item["name"] == renamed
        and item["price"] == 13500
        for item in listed_after_update.json()
    )

    deleted = admin_session.delete(f"{BASE_URL}/api/products/{product_id}")
    assert deleted.status_code == 200
    assert deleted.json() == {"id": product_id, "deleted": True}
    assert admin_session.get(f"{BASE_URL}/api/products").status_code == 200
    assert all(item["id"] != product_id for item in admin_session.get(f"{BASE_URL}/api/products").json())


def test_product_validation_and_missing_product_errors(admin_session):
    invalid = admin_session.post(
        f"{BASE_URL}/api/products", json={"name": "   ", "price": -1}
    )
    assert invalid.status_code == 400
    missing_id = str(uuid.uuid4())
    assert admin_session.put(
        f"{BASE_URL}/api/products/{missing_id}",
        json={"name": "Missing", "price": 1},
    ).status_code == 404
    assert admin_session.delete(f"{BASE_URL}/api/products/{missing_id}").status_code == 404


def test_order_create_and_persist_with_product(admin_session):
    name = f"TEST_ORDER_{uuid.uuid4().hex[:8]}"
    product = admin_session.post(
        f"{BASE_URL}/api/products", json={"name": name, "price": 5000}
    ).json()
    try:
        order = admin_session.post(
            f"{BASE_URL}/api/orders",
            json={
                "customer_name": "TEST_Customer",
                "order_type": "dine in",
                "payment_method": "cash",
                "paid_amount": 10000,
                "items": [{"product_id": product["id"], "name": name, "price": 5000, "qty": 2}],
            },
        )
        assert order.status_code == 200
        created_order = order.json()
        assert created_order["total"] == 10000
        assert created_order["items"][0]["name"] == name
        orders = admin_session.get(f"{BASE_URL}/api/orders")
        assert orders.status_code == 200
        assert any(item["id"] == created_order["id"] for item in orders.json())
    finally:
        admin_session.delete(f"{BASE_URL}/api/products/{product['id']}")