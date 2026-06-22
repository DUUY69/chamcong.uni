using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using WorkforceManagement.Api.Data;
using WorkforceManagement.Api.Middleware;
using WorkforceManagement.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Port: ASPNETCORE_URLS > PORT > Production mặc định 5002 (tránh đụng AdminDashboard port 5000)
var aspnetUrls = Environment.GetEnvironmentVariable("ASPNETCORE_URLS");
var port = Environment.GetEnvironmentVariable("PORT");
if (string.IsNullOrWhiteSpace(aspnetUrls))
{
    if (string.IsNullOrWhiteSpace(port) && builder.Environment.IsProduction())
        port = "5002";
    if (!string.IsNullOrWhiteSpace(port))
        builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

// ── Database ──────────────────────────────────────────────────────────────────
var connStr = builder.Configuration.GetConnectionString("DefaultConnection");
if (!string.IsNullOrEmpty(connStr))
{
    var isSqlServer = connStr.Contains("Server=", StringComparison.OrdinalIgnoreCase)
        || connStr.Contains("Data Source=", StringComparison.OrdinalIgnoreCase);
    if (!isSqlServer && !connStr.Contains("Encoding=", StringComparison.OrdinalIgnoreCase))
        connStr += ";Encoding=UTF8";

    builder.Services.AddDbContext<AppDbContext>(opt =>
    {
        if (isSqlServer)
            opt.UseSqlServer(connStr);
        else
            opt.UseNpgsql(connStr);
    });
}
else
{
    throw new InvalidOperationException("Missing ConnectionStrings:DefaultConnection");
}

// ── JWT Auth ──────────────────────────────────────────────────────────────────
var jwtKey = builder.Configuration["Jwt:Key"]!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

// ── CORS ──────────────────────────────────────────────────────────────────────
var corsOrigins = (builder.Configuration["Cors:Origins"] ?? "http://localhost:5174")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(opt =>
    opt.AddDefaultPolicy(p => p.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod()));

// ── Services ──────────────────────────────────────────────────────────────────
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<PayrollService>();
builder.Services.AddScoped<WorkforceAssistantService>();

// ── Controllers + Swagger ─────────────────────────────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(opt =>
    {
        opt.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Workforce Management API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        In = ParameterLocation.Header,
        Description = "Nhập JWT token: Bearer {token}",
        Name = "Authorization",
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// ── Middleware pipeline ───────────────────────────────────────────────────────
app.UseMiddleware<ExceptionMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();
