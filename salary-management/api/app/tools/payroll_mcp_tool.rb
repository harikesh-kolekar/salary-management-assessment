class PayrollMcpTool < ::MCP::Tool
  tool_name "ask_payroll"
  title "Ask payroll reports"
  description "Answer an employee or compensation question using reports the authenticated user is allowed to access."
  input_schema(
    properties: {
      question: { type: "string", minLength: 1, maxLength: 500, description: "An employee roster, department, country, salary-history, or compensation report question." },
      page: { type: "integer", minimum: 1, maximum: 10_000, description: "One-based page of report rows, when the question requests a list." }
    },
    required: ["question"]
  )
  annotations(read_only_hint: true, destructive_hint: false, idempotent_hint: true, open_world_hint: false)

  def self.call(question:, page: 1, server_context:)
    question = question.to_s.strip
    return tool_response({ error: "A question is required." }, error: true) if question.blank?
    return tool_response({ error: "Keep questions under 500 characters." }, error: true) if question.length > 500

    user = User.find_by(id: server_context.fetch(:user_id))
    return tool_response({ error: "The authenticated user is no longer available." }, error: true) unless user

    result = Reports::PayrollAssistant.new(
      employee_scope: Employees::VisibleScope.for(user),
      page: normalized_page(page)
    ).call(question)

    tool_response(result)
  rescue Reports::PayrollAssistant::MissingProviderConfig
    tool_response({ error: "The payroll assistant is not configured." }, error: true)
  rescue StandardError => error
    Rails.logger.warn("MCP payroll tool failed: #{error.class}")
    tool_response({ error: "The report could not be completed." }, error: true)
  end

  def self.normalized_page(value)
    [[Integer(value, exception: false) || 1, 1].max, 10_000].min
  end
  private_class_method :normalized_page

  def self.tool_response(payload, error: false)
    MCP::Tool::Response.new(
      [{ type: "text", text: payload.to_json }],
      structured_content: payload,
      error:
    )
  end
  private_class_method :tool_response
end
