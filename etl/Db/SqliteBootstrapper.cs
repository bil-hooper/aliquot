using System.Reflection;
using Microsoft.Data.Sqlite;

namespace Aliquot.Etl.Db;

/// <summary>Creates and opens the staging SQLite database (§1.2, §8: "the SQLite file is the source of truth").</summary>
public static class SqliteBootstrapper
{
    public static SqliteConnection OpenAndMigrate(string dbPath)
    {
        var connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = dbPath,
            Mode = SqliteOpenMode.ReadWriteCreate,
        }.ToString();

        var connection = new SqliteConnection(connectionString);
        connection.Open();

        using (var pragma = connection.CreateCommand())
        {
            pragma.CommandText = "PRAGMA journal_mode=WAL;";
            pragma.ExecuteNonQuery();
        }

        using var command = connection.CreateCommand();
        command.CommandText = ReadEmbeddedSchema();
        command.ExecuteNonQuery();

        return connection;
    }

    private static string ReadEmbeddedSchema()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var resourceName = assembly.GetManifestResourceNames()
            .Single(name => name.EndsWith("Schema.sql", StringComparison.Ordinal));

        using var stream = assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"Embedded resource '{resourceName}' not found.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
