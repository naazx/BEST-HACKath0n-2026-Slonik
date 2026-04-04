using Fulogi.Core.Enums;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Fulogi.Serialization;

public sealed class PriorityJsonConverter : JsonConverter<Priority>
{
    public override Priority Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Number && reader.TryGetInt32(out var number))
        {
            return number switch
            {
                1 => Priority.Low,
                2 => Priority.Medium,
                3 => Priority.High,
                _ => throw new JsonException("Priority must be 1..3.")
            };
        }

        if (reader.TokenType != JsonTokenType.String)
        {
            throw new JsonException("Priority must be a string or number.");
        }

        var value = reader.GetString()?.Trim();
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new JsonException("Priority is required.");
        }

        var normalized = value.Replace("_", string.Empty).Replace("-", string.Empty).ToLowerInvariant();

        return normalized switch
        {
            "1" or "low" => Priority.Low,
            "2" or "medium" => Priority.Medium,
            "3" or "high" => Priority.High,
            _ when Enum.TryParse<Priority>(value, ignoreCase: true, out var parsed) => parsed,
            _ => throw new JsonException($"Unsupported priority value: {value}")
        };
    }

    public override void Write(Utf8JsonWriter writer, Priority value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value.ToString());
    }
}