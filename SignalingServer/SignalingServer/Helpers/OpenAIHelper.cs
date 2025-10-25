using System;
using System.Net.Http;
using System.Text.Json;
using System.Text;
using System.Threading.Tasks;

namespace SignalingServer.Helpers
{
    public static class OpenAIHelper
    {
        // Key fetched from https://platform.openai.com/api-keys
        private static readonly string OPEN_AI_KEY = "YOUR_OPEN_AI_AUTH_KEY";

        private static readonly HttpClient httpClient = new();

        public static async Task<string> GenerateSDPAsync(string localSDP)
        {
            try
            {
                var sessionConfig = new
                {
                    type = "realtime",
                    model = "gpt-realtime-mini", // or "gpt-realtime"
                    audio = new
                    {
                        output = new { voice = "marin" }
                    }
                };

                var sessionJson = JsonSerializer.Serialize(sessionConfig);

                using var form = new MultipartFormDataContent();
                form.Add(new StringContent(localSDP, Encoding.UTF8, "application/sdp"), "sdp");
                form.Add(new StringContent(sessionJson, Encoding.UTF8, "application/sdp"), "session");

                var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/realtime/calls");
                request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", OPEN_AI_KEY);
                request.Content = form;

                var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
                string responseText = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode) 
                {
                    throw new Exception($"OpenAI API error: {response.StatusCode} - {responseText}");
                }

                return responseText;
            }
            catch (Exception ex)
            {
                throw new Exception("Failed to generate SDP", ex);
            }
        }
    }
}
