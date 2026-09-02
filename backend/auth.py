import os
import json
import base64
import firebase_admin
from firebase_admin import credentials, auth
from dotenv import load_dotenv

load_dotenv()

_firebase_initialized = False

# Initialize Firebase Admin SDK
# Priority: 1) FIREBASE_CREDENTIALS_JSON env var (Render/production)
#            2) firebase-credentials.json file (local dev)
#            3) DEV mode fallback (no verification)
if not firebase_admin._apps:
    cred = None

    # Option 1: Read from environment variable (set this on Render)
    firebase_creds_json = os.environ.get("FIREBASE_CREDENTIALS_JSON")
    if firebase_creds_json:
        try:
            cred_dict = json.loads(firebase_creds_json)
            cred = credentials.Certificate(cred_dict)
            print("INFO: Firebase Admin SDK initialized from FIREBASE_CREDENTIALS_JSON env var.")
        except Exception as e:
            print(f"ERROR: Failed to parse FIREBASE_CREDENTIALS_JSON: {e}")

    # Option 2: Read from local file (local dev)
    if cred is None:
        cred_path = os.path.join(os.path.dirname(__file__), "firebase-credentials.json")
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            print("INFO: Firebase Admin SDK initialized from firebase-credentials.json file.")

    if cred is not None:
        firebase_admin.initialize_app(cred)
        _firebase_initialized = True
    else:
        print("WARNING: No Firebase credentials found. Running in DEV mode (no token signature verification).")
else:
    _firebase_initialized = True


def _decode_jwt_payload_unverified(token: str) -> dict:
    """
    Decodes JWT payload WITHOUT verifying the signature.
    Only used in local dev mode when Firebase Admin is not initialized.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid JWT format")
        # Add padding if necessary
        payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
        payload_bytes = base64.urlsafe_b64decode(payload_b64)
        payload = json.loads(payload_bytes)
        # Map Firebase JWT claims to expected keys
        return {
            "uid": payload.get("user_id") or payload.get("sub"),
            "email": payload.get("email"),
            "email_verified": payload.get("email_verified", False),
        }
    except Exception as e:
        raise ValueError(f"Failed to decode token: {e}")


def verify_firebase_token(token: str) -> dict:
    """
    Verifies a Firebase ID token and returns the decoded token payload.
    In production: uses Firebase Admin SDK for full cryptographic verification.
    In dev (no credentials file): decodes payload without signature verification.
    Raises ValueError if the token is invalid.
    """
    try:
        if _firebase_initialized:
            decoded_token = auth.verify_id_token(token)
        else:
            decoded_token = _decode_jwt_payload_unverified(token)
        return decoded_token
    except Exception as e:
        raise ValueError(f"Invalid Firebase token: {e}")

def delete_firebase_user(uid: str):
    """
    Deletes a user from Firebase Auth by UID.
    """
    try:
        if _firebase_initialized:
            auth.delete_user(uid)
        else:
            print(f"DEV MODE: Skipped deleting Firebase user {uid}")
    except Exception as e:
        print(f"Failed to delete Firebase user {uid}: {e}")
