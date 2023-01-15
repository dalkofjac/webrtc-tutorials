using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;

namespace SignalingServer.Hubs
{
    [Authorize]
    public class MeshSignalingHub : Hub
    {
        private static readonly Dictionary<string, List<string>> ConnectedClients = new();

        public async Task SendMessage(object message, string roomName, string receiver = null)
        {
            if (IsClientInRoom(roomName))
            {
                if (receiver == null)
                {
                    await EmitLog("Client " + Context.ConnectionId + " sent a message to the whole room: " + message, roomName);
                    await Clients.OthersInGroup(roomName).SendAsync("message", message, Context.ConnectionId);
                }
                else 
                {
                    await EmitLog("Client " + Context.ConnectionId + " sent a message to the client " + receiver + ": " + message, roomName);
                    await Clients.Client(receiver).SendAsync("message", message, Context.ConnectionId);
                }
            }
        }

        public async Task<List<string>> CreateOrJoinRoom(string roomName)
        {
            await EmitLog("Received request to create or join room " + roomName + " from a client " + Context.ConnectionId, roomName);

            if (!ConnectedClients.ContainsKey(roomName))
            {
                ConnectedClients.Add(roomName, new List<string>());
            }

            if (!ConnectedClients[roomName].Contains(Context.ConnectionId))
            {
                ConnectedClients[roomName].Add(Context.ConnectionId);
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, roomName);

            await EmitJoined(roomName);
            await EmitLog("Client " + Context.ConnectionId + " joined the room " + roomName, roomName);

            var numberOfClients = ConnectedClients[roomName].Count;
            await EmitLog("Room " + roomName + " now has " + numberOfClients + " client(s)", roomName);

            var othersInRoom = ConnectedClients[roomName].Where(c => !c.Equals(Context.ConnectionId)).ToList();
            return othersInRoom;
        }

        public async Task LeaveRoom(string roomName)
        {
            await EmitLog("Received request to leave the room " + roomName + " from a client " + Context.ConnectionId, roomName);

            if (ConnectedClients.ContainsKey(roomName) && ConnectedClients[roomName].Contains(Context.ConnectionId))
            {
                ConnectedClients[roomName].Remove(Context.ConnectionId);
                await EmitLog("Client " + Context.ConnectionId + " left the room " + roomName, roomName);

                if (ConnectedClients[roomName].Count == 0)
                {
                    ConnectedClients.Remove(roomName);
                    await EmitLog("Room " + roomName + " is now empty - resetting its state", roomName);
                }
            }

            await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomName);
        }

        private async Task EmitJoined(string roomName)
        {
            await Clients.OthersInGroup(roomName).SendAsync("joined", Context.ConnectionId);
        }

        private async Task EmitLog(string message, string roomName)
        {
            await Clients.Group(roomName).SendAsync("log", "[Server]: " + message);
        }

        private bool IsClientInRoom(string roomName) 
        {
            return ConnectedClients.ContainsKey(roomName) && ConnectedClients[roomName].Contains(Context.ConnectionId);
        }
    }
}
