require "test_helper"

class ApiV1McpTest < ActionDispatch::IntegrationTest
  test "MCP endpoint rejects requests without the app access token" do
    Thread.current[:salary_management_test_token] = nil

    post api_v1_mcp_path, params: initialize_request.to_json, headers: request_headers

    assert_response :unauthorized
    assert_equal "Authentication required", response.parsed_body.fetch("error")
  end

  test "authenticated MCP initialize and tools list expose the payroll tool" do
    post api_v1_mcp_path, params: initialize_request.to_json, headers: request_headers

    assert_response :success
    assert_equal "2025-11-25", response.parsed_body.dig("result", "protocolVersion")

    post api_v1_mcp_path, params: { jsonrpc: "2.0", id: 2, method: "tools/list" }.to_json, headers: request_headers

    assert_response :success
    tools = response.parsed_body.dig("result", "tools")
    assert_equal ["ask_payroll"], tools.map { |tool| tool.fetch("name") }
    assert_includes tools.first.fetch("inputSchema").fetch("required"), "question"
    assert_not_includes tools.first.fetch("inputSchema").fetch("properties").keys, "user_id"
  end

  test "MCP tool call answers using the authenticated app user context" do
    post api_v1_mcp_path, params: {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "ask_payroll", arguments: { question: "Tell me a joke" } }
    }.to_json, headers: request_headers

    assert_response :success
    result = response.parsed_body.fetch("result").fetch("structuredContent")
    assert_equal Reports::PayrollAssistant::OUT_OF_SCOPE_REPLY, result.fetch("answer")
    assert_nil result.fetch("report")
  end

  private

  def initialize_request
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "salary-management-test", version: "1.0" }
      }
    }
  end

  def request_headers
    { "CONTENT_TYPE" => "application/json", "HTTP_HOST" => "localhost" }
  end
end
