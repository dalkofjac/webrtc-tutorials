using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using SignalingServer.Helpers;
using SignalingServer.Models;
using System.Threading.Tasks;

namespace SignalingServer.Hubs
{
    [Authorize]
    public class OpenAIHub : Hub
    {
        public async Task<string> GenerateSDP(string localSDP)
        {
            return await OpenAIHelper.GenerateSDPAsync(localSDP);
        }
    }
}
