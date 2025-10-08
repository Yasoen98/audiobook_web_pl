from fastapi.testclient import TestClient

from tts_svc.main import app

client = TestClient(app)


def test_training_status_flow():
    response = client.post('/train', json={'modelId': 'demo'} )
    assert response.status_code == 200
    status = client.get('/train/demo/status')
    assert status.status_code == 200
    assert status.json()['id'] == 'demo'
