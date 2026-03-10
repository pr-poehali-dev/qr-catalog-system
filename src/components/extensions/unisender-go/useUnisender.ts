/**
 * Unisender Go Extension - React Hook
 *
 * Hook for sending transactional emails via Unisender Go.
 */

import { useState, useCallback } from "react";

// =============================================================================
// TYPES
// =============================================================================

interface UseUnisenderConfig {
  apiUrl: string;
}

interface SendEmailParams {
  to_email: string;
  to_name?: string;
  subject: string;
  body_html: string;
  substitutions?: Record<string, string>;
  tags?: string[];
}

interface SendTemplateParams {
  to_email: string;
  to_name?: string;
  template_id: string;
  subject?: string;
  substitutions?: Record<string, string>;
}

interface SendTestParams {
  to_email: string;
}

interface SendResult {
  success: boolean;
  job_id?: string;
  error?: string;
}

interface UseUnisenderReturn {
  /** Send email with custom HTML body */
  sendEmail: (params: SendEmailParams) => Promise<SendResult>;
  /** Send email using saved template */
  sendTemplate: (params: SendTemplateParams) => Promise<SendResult>;
  /** Send test email to verify configuration */
  sendTest: (params: SendTestParams) => Promise<SendResult>;
  /** Loading state */
  isLoading: boolean;
  /** Last error message */
  error: string | null;
}

// =============================================================================
// HOOK
// =============================================================================

export function useUnisender({ apiUrl }: UseUnisenderConfig): UseUnisenderReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendEmail = useCallback(
    async (params: SendEmailParams): Promise<SendResult> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiUrl}?action=send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Send failed");
          return { success: false, error: data.error };
        }

        return { success: true, job_id: data.job_id };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Network error";
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [apiUrl]
  );

  const sendTemplate = useCallback(
    async (params: SendTemplateParams): Promise<SendResult> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiUrl}?action=send-template`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Send failed");
          return { success: false, error: data.error };
        }

        return { success: true, job_id: data.job_id };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Network error";
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [apiUrl]
  );

  const sendTest = useCallback(
    async (params: SendTestParams): Promise<SendResult> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiUrl}?action=test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Test failed");
          return { success: false, error: data.error };
        }

        return { success: true, job_id: data.job_id };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Network error";
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [apiUrl]
  );

  return { sendEmail, sendTemplate, sendTest, isLoading, error };
}

export default useUnisender;
