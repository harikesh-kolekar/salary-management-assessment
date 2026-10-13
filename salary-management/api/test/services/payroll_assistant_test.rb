require "test_helper"

class PayrollAssistantTest < ActiveSupport::TestCase
  setup do
    @assistant = Reports::PayrollAssistant.new(employee_scope: Employee.none)
  end

  test "recognizes pie chart requests including the pi-chart spelling" do
    question = "Give me count of employee with pi-chart with department"

    assert_equal "pie", @assistant.send(:requested_chart_type, question)
    assert_not @assistant.send(:requested_rows?, question)
  end

  test "requests a table for employee lists without adding a chart" do
    question = "Give me the employee list for Engineering"

    assert_nil @assistant.send(:requested_chart_type, question)
    assert @assistant.send(:requested_rows?, question)
  end

  test "does not request rows for aggregate counts" do
    ["Count employees by department", "How many employees are in Engineering?"].each do |question|
      assert_not @assistant.send(:requested_rows?, question), question
    end
  end

  test "rejects an assistant response when no report tool result exists" do
    assert_raises(Reports::PayrollAssistant::MissingReport) do
      @assistant.send(:build_result, "", nil)
    end
  end

  test "uses a visible fallback answer when the report exists but assistant text is blank" do
    result = @assistant.send(:build_result, "", { total: 0 })

    assert_equal "Here is the report you requested.", result[:answer]
    assert_equal 0, result.dig(:report, :total)
  end
end
