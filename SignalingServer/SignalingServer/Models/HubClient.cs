using System.Collections.Generic;

namespace SignalingServer.Models
{
    public class HubClient
    {
        public string Id { get; set; }

        public string Type { get; set; }

        public HubClient(string id, string type)
        {
            Id = id;
            Type = type;
        }
    }

    public static class HubClientType
    {
        public static readonly string CentralUnit = "central_unit";

        public static readonly string SideUnit = "side_unit";

        public static readonly List<string> AllTypes = new() { CentralUnit, SideUnit };
    }
}
