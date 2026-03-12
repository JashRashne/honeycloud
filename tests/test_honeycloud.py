"""
HoneyCloud test suite.
"""
import pytest
from click.testing import CliRunner
from honeycloud.cli import main
from honeycloud import score


class TestCLI:
    def setup_method(self):
        self.runner = CliRunner()

    def test_version(self):
        result = self.runner.invoke(main, ["--version"])
        assert result.exit_code == 0
        assert "0.1.1" in result.output

    def test_deploy_mock(self):
        result = self.runner.invoke(main, ["deploy", "--mock"])
        assert result.exit_code == 0
        assert "ACTIVE" in result.output

    def test_monitor_sample(self):
        result = self.runner.invoke(main, ["monitor"])
        assert result.exit_code == 0
        assert "MITRE" in result.output or "T1" in result.output

    def test_score_known_malicious(self):
        result = self.runner.invoke(main, ["score", "45.33.32.156"])
        assert result.exit_code == 0
        assert "CRITICAL" in result.output or "HIGH" in result.output

    def test_score_private_ip(self):
        result = self.runner.invoke(main, ["score", "192.168.1.1"])
        assert result.exit_code == 0
        assert "LOW" in result.output or "MEDIUM" in result.output

    def test_score_returns_mitre(self):
        result = self.runner.invoke(main, ["score", "45.33.32.156"])
        assert result.exit_code == 0
        assert "T1110" in result.output or "T1046" in result.output


class TestScoring:
    def test_isolation_score_range(self):
        features = score._ip_to_features("8.8.8.8")
        s = score._isolation_score(features)
        assert 0.0 <= s <= 1.0

    def test_private_ip_lower_score(self):
        pub_features = score._ip_to_features("45.33.32.156")
        prv_features = score._ip_to_features("192.168.1.100")
        pub_score = score._isolation_score(pub_features)
        prv_score = score._isolation_score(prv_features)
        assert prv_score < pub_score

    def test_threat_label_critical(self):
        label, _, _ = score._threat_label(0.95)
        assert label == "CRITICAL"

    def test_threat_label_low(self):
        label, _, _ = score._threat_label(0.1)
        assert label == "LOW"
