using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using SignalingServer.Models;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SignalingServer.Hubs
{
    public class StarSignalingHub : Hub
    {
        private static readonly Dictionary<string, List<HubClient>> ConnectedClients = new();

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

        public async Task<List<string>> CreateOrJoinRoom(string roomName, string clientType)
        {
            await EmitLog("Received request to create or join room " + roomName + " from a client " + Context.ConnectionId + " of type " + clientType, roomName);

            if (clientType == HubClientType.CentralUnit && ConnectedClients.ContainsKey(roomName)
                && ConnectedClients[roomName].Where(c => c.Type == HubClientType.CentralUnit).FirstOrDefault() != null) 
            {
                await EmitFull();
                return null;
            }

            if (!ConnectedClients.ContainsKey(roomName))
            {
                ConnectedClients.Add(roomName, new List<HubClient>());
            }

            if (!IsClientInRoom(roomName))
            {
                ConnectedClients[roomName].Add(new HubClient(Context.ConnectionId, clientType));
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, roomName);

            await EmitJoined(roomName, clientType);
            await EmitLog("Client " + Context.ConnectionId + " of type " + clientType + " joined the room " + roomName, roomName);

            var numberOfClients = ConnectedClients[roomName].Count;
            await EmitLog("Room " + roomName + " now has " + numberOfClients + " client(s)", roomName);

            return GetOppositeTypeHubClients(roomName, clientType);
        }

        public async Task LeaveRoom(string roomName)
        {
            await EmitLog("Received request to leave the room " + roomName + " from a client " + Context.ConnectionId, roomName);

            if (IsClientInRoom(roomName))
            {
                var clientToRemove = ConnectedClients[roomName].Where(c => c.Id == Context.ConnectionId).FirstOrDefault();
                ConnectedClients[roomName].Remove(clientToRemove);
                await EmitLog("Client " + Context.ConnectionId + " of type " + clientToRemove.Type + " left the room " + roomName, roomName);

                if (ConnectedClients[roomName].Count == 0)
                {
                    ConnectedClients.Remove(roomName);
                    await EmitLog("Room " + roomName + " is now empty - resetting its state", roomName);
                }
            }

            await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomName);
        }

        private async Task EmitJoined(string roomName, string clientType)
        {
            await Clients.Clients(GetOppositeTypeHubClients(roomName, clientType)).SendAsync("joined", Context.ConnectionId);
        }

        private async Task EmitFull()
        {
            await Clients.Caller.SendAsync("full");
        }

        private async Task EmitLog(string message, string roomName)
        {
            await Clients.Group(roomName).SendAsync("log", "[Server]: " + message);
        }

        private bool IsClientInRoom(string roomName)
        {
            return ConnectedClients.ContainsKey(roomName) && ConnectedClients[roomName].Where(c => c.Id == Context.ConnectionId).FirstOrDefault() != null;
        }

        private List<string> GetOppositeTypeHubClients(string roomName, string clientType) 
        { 
            return ConnectedClients[roomName]?.Where(c => c.Type == HubClientType.AllTypes.FirstOrDefault(t => t != clientType))?.Select(c => c.Id).ToList();
        }
    }
}
