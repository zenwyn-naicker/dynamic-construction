using System.Text.Json;
using System.Text.Json.Serialization;

namespace DynamicConstruction.Api.Infrastructure;

public sealed class UtcDateTimeConverter : JsonConverter<DateTime>
{
    private static DateTime Utc(DateTime value) => value.Kind == DateTimeKind.Unspecified
        ? DateTime.SpecifyKind(value, DateTimeKind.Utc)
        : value.ToUniversalTime();

    public override DateTime Read(ref Utf8JsonReader reader, Type type, JsonSerializerOptions options) => Utc(reader.GetDateTime());

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options) => writer.WriteStringValue(Utc(value));
}
