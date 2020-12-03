using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SignalingServer.Hubs
{
    [AllowAnonymous]
    public class AuthHub : Hub
    {
        public Task<string> Authorize()
        {
            return Task.Run(() => { return TokenHelper.GenerateToken(); });
        }
    }
}
