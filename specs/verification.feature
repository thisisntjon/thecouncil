Feature: Multi-agent verification swarm
  The Council should turn one answer into an auditable deliberation.

  Background:
    Given fixture mode is enabled
    And no live provider API keys are required
    And the public fixture question is loaded

  Scenario: Independent agents answer before critique
    When the Council fixture demo runs
    Then four Council agents produce independent answers
    And each answer keeps its role and claim identifiers

  Scenario: Peer critique preserves disagreement
    When peer critique runs
    Then each review records a reviewer, target, score, strength, and weakness
    And revision pressure remains visible in the report

  Scenario: Hidden verification checks claims
    When the hidden verification swarm evaluates fixture claims
    Then each claim receives a verdict, confidence score, evidence reference, and reasoning
    And unsupported or unresolved claims are not hidden by final synthesis

  Scenario: Final synthesis exports an audit trail
    When the fixture report is written
    Then JSON and Markdown reports are created under sample_outputs
    And the reports include stages, verified claims, confidence summary, unresolved claims, and audit trail

  Scenario: Public demo remains safe and reproducible
    When the validation commands run
    Then the fixture demo, tests, secret scan, and MCP self-test pass without live provider calls
