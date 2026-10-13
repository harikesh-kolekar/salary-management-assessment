module Api
  module V1
    class McpController < BaseController
      def handle
        server = ::MCP::Server.new(
          name: "acme-people",
          title: "ACME People payroll reports",
          version: "1.0.0",
          instructions: "Use ask_payroll to answer employee and compensation questions within the authenticated user's existing access.",
          tools: [PayrollMcpTool],
          server_context: { user_id: current_user.id }
        )
        transport = ::MCP::Server::Transports::StreamableHTTPTransport.new(
          server,
          stateless: true,
          serve_subscriptions_listen: false,
          enable_json_response: true,
          **transport_host_options
        )
        status, headers, body = transport.handle_request(request)

        headers.each { |name, value| response.headers[name] = value }
        self.status = status
        self.response_body = body
      end

      private

      def transport_host_options
        options = {}
        allowed_hosts = ENV.fetch("MCP_ALLOWED_HOSTS", "").split(",").map(&:strip).reject(&:blank?)
        allowed_origins = ENV.fetch("MCP_ALLOWED_ORIGINS", "").split(",").map(&:strip).reject(&:blank?)
        options[:allowed_hosts] = allowed_hosts if allowed_hosts.any?
        options[:allowed_origins] = allowed_origins if allowed_origins.any?
        options
      end
    end
  end
end
