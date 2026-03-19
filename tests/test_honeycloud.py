"""
HoneyCloud test suite — v0.1.8
Tests are designed to work without a running DB or Docker instance.
"""
import pytest
from click.testing import CliRunner
from honeycloud.cli import main
from honeycloud import score as score_mod


# ─────────────────────────────────────────────
#  CLI Tests
# ─────────────────────────────────────────────

class TestCLI:
    def setup_method(self):
        self.runner = CliRunner()

    def test_version(self):
        result = self.runner.invoke(main, ["--version"])
        assert result.exit_code == 0
        assert "0.1.8" in result.output

    def test_deploy_mock(self):
        result = self.runner.invoke(main, ["deploy", "--mock"])
        assert result.exit_code == 0
        assert "ACTIVE" in result.output

    def test_monitor_sample(self):
        result = self.runner.invoke(main, ["monitor"])
        assert result.exit_code == 0
        assert "MITRE" in result.output or "T1" in result.output

    def test_score_known_malicious(self):
        # 45.33.32.156 is in KNOWN_MALICIOUS — score gets +0.25 bump
        result = self.runner.invoke(main, ["score", "45.33.32.156"])
        assert result.exit_code == 0
        assert "CRITICAL" in result.output or "HIGH" in result.output

    def test_score_private_ip(self):
        # Private IPs get score * 0.3 dampening → should be LOW
        result = self.runner.invoke(main, ["score", "192.168.1.1"])
        assert result.exit_code == 0
        assert "LOW" in result.output or "MEDIUM" in result.output

    def test_score_returns_mitre(self):
        result = self.runner.invoke(main, ["score", "45.33.32.156"])
        assert result.exit_code == 0
        # Any MITRE technique ID starts with T1
        assert "T1" in result.output

    def test_serve_help(self):
        result = self.runner.invoke(main, ["serve", "--help"])
        assert result.exit_code == 0
        assert "--host" in result.output
        assert "--port" in result.output
        assert "--reload" in result.output

    def test_collect_help(self):
        result = self.runner.invoke(main, ["collect", "--help"])
        assert result.exit_code == 0
        assert "--log-path" in result.output
        assert "--dry-run" in result.output
        assert "--from-start" in result.output


# ─────────────────────────────────────────────
#  Feature Vector Tests
# ─────────────────────────────────────────────

class TestFeatureVector:
    def test_returns_all_26_features(self):
        features = score_mod._build_feature_vector("8.8.8.8")
        # Must have exactly the 26 flow features
        assert len(features) == 26

    def test_feature_keys_present(self):
        features = score_mod._build_feature_vector("1.2.3.4")
        required = [
            "dst_port", "src_port", "hour", "day_of_week",
            "dst_port_bucket", "src_port_bucket", "packet_count",
            "total_bytes", "mean_pkt_size", "std_pkt_size",
            "total_payload", "mean_ttl", "flag_syn_count",
            "flag_ack_count", "flag_rst_count", "flag_fin_count",
            "flag_psh_count", "is_tcp", "is_udp", "is_icmp",
            "flow_duration_sec", "bytes_per_packet", "syn_ratio",
            "rst_ratio", "fin_ratio", "is_syn_scan",
        ]
        for key in required:
            assert key in features, f"Missing feature: {key}"

    def test_all_values_are_float(self):
        features = score_mod._build_feature_vector("10.0.0.1")
        for k, v in features.items():
            assert isinstance(v, float), f"{k} is not float: {type(v)}"

    def test_deterministic(self):
        # Same IP must always produce the same feature vector
        f1 = score_mod._build_feature_vector("8.8.8.8")
        f2 = score_mod._build_feature_vector("8.8.8.8")
        assert f1 == f2

    def test_different_ips_differ(self):
        f1 = score_mod._build_feature_vector("1.1.1.1")
        f2 = score_mod._build_feature_vector("2.2.2.2")
        assert f1 != f2

    def test_syn_ratio_range(self):
        features = score_mod._build_feature_vector("5.5.5.5")
        assert 0.0 <= features["syn_ratio"] <= 1.0

    def test_rst_ratio_range(self):
        features = score_mod._build_feature_vector("5.5.5.5")
        assert 0.0 <= features["rst_ratio"] <= 1.0

    def test_is_syn_scan_binary(self):
        features = score_mod._build_feature_vector("5.5.5.5")
        assert features["is_syn_scan"] in (0.0, 1.0)

    def test_session_data_overrides(self):
        # When session_data is provided, those values should be used
        session = {"dst_port": 9999, "packet_count": 42}
        features = score_mod._build_feature_vector("1.2.3.4", session_data=session)
        assert features["dst_port"] == 9999.0
        assert features["packet_count"] == 42.0


# ─────────────────────────────────────────────
#  Threat Label Tests
# ─────────────────────────────────────────────

class TestThreatLabel:
    def test_critical(self):
        label, color, icon = score_mod._threat_label(0.80)
        assert label == "CRITICAL"
        assert icon == "🔴"

    def test_critical_above_threshold(self):
        label, _, _ = score_mod._threat_label(0.95)
        assert label == "CRITICAL"

    def test_high(self):
        label, _, _ = score_mod._threat_label(0.60)
        assert label == "HIGH"

    def test_high_mid(self):
        label, _, _ = score_mod._threat_label(0.70)
        assert label == "HIGH"

    def test_medium(self):
        label, _, _ = score_mod._threat_label(0.40)
        assert label == "MEDIUM"

    def test_medium_mid(self):
        label, _, _ = score_mod._threat_label(0.55)
        assert label == "MEDIUM"

    def test_low(self):
        label, _, _ = score_mod._threat_label(0.10)
        assert label == "LOW"

    def test_low_zero(self):
        label, _, _ = score_mod._threat_label(0.0)
        assert label == "LOW"

    def test_boundary_just_below_critical(self):
        label, _, _ = score_mod._threat_label(0.799)
        assert label == "HIGH"

    def test_boundary_just_below_high(self):
        label, _, _ = score_mod._threat_label(0.599)
        assert label == "MEDIUM"

    def test_boundary_just_below_medium(self):
        label, _, _ = score_mod._threat_label(0.399)
        assert label == "LOW"

    def test_returns_tuple_of_three(self):
        result = score_mod._threat_label(0.5)
        assert len(result) == 3


# ─────────────────────────────────────────────
#  ML Scoring Tests (require models to be loaded)
# ─────────────────────────────────────────────

class TestMLScoring:
    def setup_method(self):
        """Load models once before each test — skips if models missing."""
        self._models_ok = score_mod._load_models()

    def test_models_load(self):
        assert self._models_ok, (
            f"Models failed to load: {score_mod._CACHE.get('error')}"
        )

    def test_isolation_forest_score_range(self):
        if not self._models_ok:
            pytest.skip("Models not loaded")
        features = score_mod._build_feature_vector("8.8.8.8")
        X = score_mod._features_to_array(features)
        raw = score_mod._CACHE["iso"].decision_function(X)[0]
        anomaly_score = float(__import__("numpy").clip(0.5 - raw, 0.0, 1.0))
        assert 0.0 <= anomaly_score <= 1.0

    def test_features_to_array_shape(self):
        if not self._models_ok:
            pytest.skip("Models not loaded")
        features = score_mod._build_feature_vector("1.2.3.4")
        X = score_mod._features_to_array(features)
        assert X.shape == (1, 26)

    def test_attack_type_is_known_class(self):
        if not self._models_ok:
            pytest.skip("Models not loaded")
        import numpy as np
        features = score_mod._build_feature_vector("8.8.8.8")
        X = score_mod._features_to_array(features)
        xgb_p = score_mod._CACHE["xgb"].predict_proba(X)[0]
        rf_p  = score_mod._CACHE["rf"].predict_proba(X)[0]
        ensemble = (xgb_p + rf_p) / 2
        pred_idx = int(np.argmax(ensemble))
        attack_type = score_mod._CACHE["le"].inverse_transform([pred_idx])[0]
        valid_classes = [
            "ssh_bruteforce", "vnc_bruteforce", "web_scan", "telnet_probe",
            "db_probe", "smb_exploit", "ftp_probe", "snmp_probe",
            "iot_probe", "port_scan", "icmp_scan",
        ]
        assert attack_type in valid_classes

    def test_known_malicious_ip_scores_higher(self):
        if not self._models_ok:
            pytest.skip("Models not loaded")
        import numpy as np
        # Score a known malicious IP and verify the +0.25 bump pushes it high
        ip = "45.33.32.156"
        features = score_mod._build_feature_vector(ip)
        X = score_mod._features_to_array(features)
        raw = score_mod._CACHE["iso"].decision_function(X)[0]
        base_score = float(np.clip(0.5 - raw, 0.0, 1.0))
        bumped = min(base_score + 0.25, 1.0)
        label, _, _ = score_mod._threat_label(bumped)
        assert label in ("HIGH", "CRITICAL")

    def test_private_ip_dampened(self):
        if not self._models_ok:
            pytest.skip("Models not loaded")
        import numpy as np
        ip = "192.168.1.100"
        features = score_mod._build_feature_vector(ip)
        X = score_mod._features_to_array(features)
        raw = score_mod._CACHE["iso"].decision_function(X)[0]
        base_score = float(np.clip(0.5 - raw, 0.0, 1.0))
        dampened = max(base_score * 0.3, 0.0)
        assert dampened < base_score


# ─────────────────────────────────────────────
#  KNOWN_MALICIOUS / MITRE_MAP Tests
# ─────────────────────────────────────────────

class TestIntelData:
    def test_known_malicious_has_entries(self):
        assert len(score_mod.KNOWN_MALICIOUS) > 0

    def test_known_malicious_entry_structure(self):
        for ip, val in score_mod.KNOWN_MALICIOUS.items():
            assert isinstance(val, tuple), f"{ip} value is not a tuple"
            assert len(val) == 2, f"{ip} tuple should have 2 elements"

    def test_mitre_map_covers_all_classes(self):
        valid_classes = [
            "ssh_bruteforce", "vnc_bruteforce", "web_scan", "telnet_probe",
            "db_probe", "smb_exploit", "ftp_probe", "snmp_probe",
            "iot_probe", "port_scan", "icmp_scan",
        ]
        for cls in valid_classes:
            assert cls in score_mod.MITRE_MAP, f"Missing MITRE mapping for {cls}"

    def test_mitre_entries_have_technique_ids(self):
        for attack, techniques in score_mod.MITRE_MAP.items():
            for tid, tname in techniques:
                assert tid.startswith("T"), f"{attack}: bad technique ID {tid}"
                assert len(tname) > 0