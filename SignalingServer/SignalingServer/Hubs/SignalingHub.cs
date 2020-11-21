using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SignalingServer.Hubs
{
    // [Authorize]
    public class SignalingHub : Hub
    {
        public Dictionary<string, List<string>> ConnectedClients = new Dictionary<string, List<string>>();

        public Task SendMessage(object message, string roomName)
        {
            EmitLog("Client said: " + message, roomName);

            return Clients.OthersInGroup(roomName).SendAsync("message", message);
        }

        public Task CreateOrJoinRoom(string roomName)
        {
            EmitLog("Received request to create or join room " + roomName + " from a client " + Context.ConnectionId, roomName);

            if (!ConnectedClients.ContainsKey(roomName))
            {
                ConnectedClients.Add(roomName, new List<string>());
            }

            if (!ConnectedClients[roomName].Contains(Context.ConnectionId))
            {
                ConnectedClients[roomName].Add(Context.ConnectionId);
            }

            EmitJoinRoom(roomName);
            
            var numberOfClients = ConnectedClients[roomName].Count;

            if (numberOfClients == 1)
            {
                EmitCreated(roomName);
                EmitLog("Client "+ Context.ConnectionId + " created the room " + roomName, roomName);
            }
            else
            {
                EmitJoined(roomName);
                EmitLog("Client " + Context.ConnectionId + " joined the room " + roomName, roomName);
            }

            EmitLog("Room " + roomName + " now has " + numberOfClients + " client(s)", roomName);

            return Task.Run(() => { return; });
        }

        public Task LeaveRoom(string roomName)
        {
            EmitLog("Received request to leave the room " + roomName + " from a client " + Context.ConnectionId, roomName);

            if (ConnectedClients.ContainsKey(roomName) && ConnectedClients[roomName].Contains(Context.ConnectionId))
            {
                ConnectedClients[roomName].Remove(Context.ConnectionId);
                EmitLog("Client " + Context.ConnectionId + " left the room " + roomName, roomName);

                if (ConnectedClients[roomName].Count == 0)
                {
                    ConnectedClients.Remove(roomName);
                    EmitLog("Room " + roomName + " is now empty - resetting its state.", roomName);
                }
            }

            return Groups.RemoveFromGroupAsync(Context.ConnectionId, roomName);
        }

        private Task EmitJoinRoom(string roomName)
        {
            return Groups.AddToGroupAsync(Context.ConnectionId, roomName);
        }

        private Task EmitCreated(string roomName)
        {
            return Clients.Caller.SendAsync("created", roomName);
        }

        private Task EmitJoined(string roomName)
        {
            return Clients.Group(roomName).SendAsync("joined", roomName);
        }

        private Task EmitLog(string message, string roomName)
        {
            return Clients.Group(roomName).SendAsync("log", message);
        }
    }
}
