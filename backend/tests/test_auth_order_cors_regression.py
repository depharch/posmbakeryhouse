import os
import uuid

import pytest
import requests


BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
FRONTEND_ORIGIN = os.environ.get("FRONTEND_URL", "https://housebakery-pos.preview.emergentagent.com")


@pytest.fixture
def admin_session():
    session = requests.Session()
    response = session.post(f"{BASE_URL}/api/auth/login", json={"username": "admin", "password": "admin"})
    assert response.status_code == 200
    assert response.json()["role"] == "admin"
    assert session.cookies.get("access_token")
    return session


def test_login_sets_httponly_cookie_and_me(admin_session):
    response = admin_session.get(f"{BASE_URL}/api/auth/me")
    assert response.status_code == 200
    assert response.json() == {"username": "admin", "role": "admin"}
    cookie = admin_session.cookies.get_dict()["access_token"]
    assert cookie


def test_login_locks_out_after_five_failures_for_unknown_username():
    username = f"lockout-{uuid.uuid4().hex}"
    statuses = [
        requests.post(f"{BASE_URL}/api/auth/login", json={"username": username, "password": "wrong"}).status_code
        for _ in range(6)
    ]
    assert statuses[:5] == [401] * 5
    assert statuses[5] == 429


def test_cors_allows_configured_origin_and_rejects_arbitrary_origin():
    allowed = requests.options(
        f"{BASE_URL}/api/auth/login",
        headers={"Origin": FRONTEND_ORIGIN, "Access-Control-Request-Method": "POST"},
    )
    rejected = requests.options(
        f"{BASE_URL}/api/auth/login",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert allowed.status_code == 200
    assert allowed.headers.get("access-control-allow-origin") == FRONTEND_ORIGIN
    assert allowed.headers.get("access-control-allow-credentials") == "true"
    assert rejected.headers.get("access-control-allow-origin") != "https://evil.example"


def test_order_id_is_unique_and_above_highest_existing_id(admin_session):
    product = admin_session.post(
        f"{BASE_URL}/api/products", json={"name": f"TEST_SEQ_{uuid.uuid4().hex[:8]}", "price": 1}
    )
    assert product.status_code == 200
    product_data = product.json()
    try:
        existing = admin_session.get(f"{BASE_URL}/api/orders")
        assert existing.status_code == 200
        prior_ids = [int(order["id"]) for order in existing.json() if str(order.get("id", "")).isdigit()]
        prior_max = max(prior_ids or [-1])
        payload = {
            "customer_name": "TEST_SEQ_CUSTOMER",
            "order_type": "dine in",
            "payment_method": "cash",
            "paid_amount": 1,
            "items": [{"product_id": product_data["id"], "name": product_data["name"], "price": 1, "qty": 1}],
        }
        first = admin_session.post(f"{BASE_URL}/api/orders", json=payload)
        second = admin_session.post(f"{BASE_URL}/api/orders", json=payload)
        assert first.status_code == 200
        assert second.status_code == 200
        first_id, second_id = int(first.json()["id"]), int(second.json()["id"])
        assert first_id > prior_max
        assert second_id == first_id + 1
        assert first.json()["id"] != second.json()["id"]
    finally:
        admin_session.delete(f"{BASE_URL}/api/products/{product_data['id']}")