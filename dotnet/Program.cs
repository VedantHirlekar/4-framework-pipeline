using MySqlConnector;

var builder = WebApplication.CreateBuilder(args);

var app = builder.Build();


app.MapGet("/health", () =>
{
    return Results.Ok(new
    {
        status = "UP",
        service = "dotnet"
    });
});


app.MapGet("/employees", async () =>
{
    var host = Environment.GetEnvironmentVariable("DB_HOST");
    var port = Environment.GetEnvironmentVariable("DB_PORT");
    var database = Environment.GetEnvironmentVariable("DB_NAME");
    var user = Environment.GetEnvironmentVariable("DB_USER");
    var password = Environment.GetEnvironmentVariable("DB_PASSWORD");

    var connectionString =
        $"Server={host};" +
        $"Port={port};" +
        $"Database={database};" +
        $"User ID={user};" +
        $"Password={password};";

    var employees = new List<object>();

    await using var connection =
        new MySqlConnection(connectionString);

    await connection.OpenAsync();

    var command = new MySqlCommand(
        "SELECT id, name FROM employees",
        connection
    );

    await using var reader =
        await command.ExecuteReaderAsync();

    while (await reader.ReadAsync())
    {
        employees.Add(new
        {
            id = reader.GetInt32("id"),
            name = reader.GetString("name")
        });
    }

    return Results.Ok(employees);
});


app.Run("http://0.0.0.0:5000");