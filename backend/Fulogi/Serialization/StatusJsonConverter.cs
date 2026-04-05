using Fulogi.Core.Enums;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Fulogi.Serialization;

public sealed class StatusJsonConverter : JsonConverter<Status>
{
    public override Status Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Number && reader.TryGetInt32(out var number))
        {
            return number switch
            {
                1 => Status.Await,
                2 => Status.InProgress,
                3 => Status.Done,
                _ => throw new JsonException("Status must be 1..3.")
            };
        }

        if (reader.TokenType != JsonTokenType.String)
        {
            throw new JsonException("Status must be a string or number.");
        }

        var value = reader.GetString()?.Trim();
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new JsonException("Status is required.");
        }

        var normalized = value.Replace("_", string.Empty).Replace("-", string.Empty).ToLowerInvariant();

        return normalized switch
        {
            "1" or "await" or "pending" => Status.Await,
            "2" or "inprogress" or "inprocess" => Status.InProgress,
            "3" or "done" or "delivered" => Status.Done,
            _ when Enum.TryParse<Status>(value, ignoreCase: true, out var parsed) => parsed,
            _ => throw new JsonException($"Unsupported status value: {value}")
        };
    }

    public override void Write(Utf8JsonWriter writer, Status value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value.ToString());
    }
}