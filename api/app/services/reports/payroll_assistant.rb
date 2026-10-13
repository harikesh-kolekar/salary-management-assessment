module Reports
  class PayrollAssistant
    class MissingProviderConfig < StandardError; end
    class MissingReport < StandardError; end

    PROJECT_TERMS = /\b(employee|employees|staff|workforce|roster|department|country|countries|salary|salaries|paid|pay\w*|compensation|increment\w*|raise\w*|increas\w*|headcount|job title|hire date|status|chart|graph|report|pay band)\b/i
    REPORT_INTENTS = /\b(list|show|find|which|who|whose|how\b|count|average|total|compare|breakdown|chart|graph|report|roster|summarize|highest|lowest|top|bottom|trend|happened|happen\w*|occurred|received)\b/i
    OUT_OF_SCOPE_REPLY = "I can only help with employee, department, and compensation reports in this application."

    def initialize(employee_scope:, page: 1)
      @employee_scope = employee_scope
      @page = page
    end

    def call(question)
      return { answer: OUT_OF_SCOPE_REPLY, report: nil } unless question.match?(PROJECT_TERMS) && question.match?(REPORT_INTENTS)
      raise MissingProviderConfig if ENV["OPENAI_API_KEY"].blank?

      report_tool = PayrollReportTool.new(
        employee_scope: @employee_scope,
        page_override: @page,
        chart_type_override: requested_chart_type(question),
        include_rows_override: requested_rows?(question)
      )
      response = PayrollReportingAgent.new
        .with_tools(report_tool)
        .with_tool_options(choice: :required, calls: :one)
        .ask(question)

      build_result(response.content, report_tool.result)
    end

    private

    def build_result(answer, report)
      raise MissingReport if report.nil?

      { answer: answer.to_s.presence || "Here is the report you requested.", report: }
    end

    def requested_chart_type(question)
      return "pie" if question.match?(/\b(?:pie|pi)[\s-]*chart\b/i)
      return "bar" if question.match?(/\bbar[\s-]*chart\b/i)

      nil
    end

    def requested_rows?(question)
      question.match?(/\b(list|roster|directory|names?|details?|records?)\b/i) ||
        question.match?(/\b(?:who|which)\s+(?:are\s+)?(?:the\s+)?(?:employees?|staff)\b|\b(?:employees?|staff)\s+(?:who|whose|that)\b/i)
    end
  end
end
