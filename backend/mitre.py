MAPPING = {
    "public_s3_bucket": "T1530 - Data from Cloud Storage",
    "iam_policy_change": "T1098 - Account Manipulation",
    "new_access_key": "T1098.001 - Additional Cloud Credentials",
    "s3_deletion": "T1485 - Data Destruction",
    "excessive_api": "T1078 - Valid Accounts / T1110 - Brute Force (API abuse)",
}

RECOMMENDATIONS = {
    "public_s3_bucket": "Disable public access and review the bucket policy. Enable Block Public Access.",
    "iam_policy_change": "Review the new permissions and remove unnecessary privileges. Follow least privilege.",
    "new_access_key": "Verify that the key was created by an authorized user. Rotate if unexpected.",
    "s3_deletion": "Verify the deletion was intentional. Enable versioning and MFA delete for the bucket.",
    "excessive_api": "Investigate the source. Check for compromised credentials or runaway automation.",
}

def technique(rule_id: str) -> str:
    return MAPPING.get(rule_id, "")

def recommendation(rule_id: str) -> str:
    return RECOMMENDATIONS.get(rule_id, "")
