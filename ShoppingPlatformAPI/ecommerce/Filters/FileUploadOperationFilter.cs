using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace ecommerce.Filters
{
    public class FileUploadOperationFilter : IOperationFilter
    {
        public void Apply(OpenApiOperation operation, OperationFilterContext context)
        {
            var fileParams = context.MethodInfo.GetParameters()
                .Where(p => p.ParameterType == typeof(IFormFile) ||
                           p.ParameterType == typeof(IEnumerable<IFormFile>) ||
                           p.ParameterType == typeof(List<IFormFile>))
                .ToList();

            if (!fileParams.Any())
            {
                // تحقق من وجود IFormFile في خصائص الـ DTO
                var dtoParams = context.MethodInfo.GetParameters()
                    .Where(p => p.CustomAttributes.Any(a => a.AttributeType.Name == "FromFormAttribute"))
                    .ToList();

                foreach (var dtoParam in dtoParams)
                {
                    var dtoType = dtoParam.ParameterType;
                    var fileProperties = dtoType.GetProperties()
                        .Where(p => p.PropertyType == typeof(IFormFile) ||
                                   p.PropertyType == typeof(IEnumerable<IFormFile>) ||
                                   p.PropertyType == typeof(List<IFormFile>))
                        .ToList();

                    if (fileProperties.Any())
                    {
                        operation.RequestBody = new OpenApiRequestBody
                        {
                            Content = new Dictionary<string, OpenApiMediaType>
                            {
                                ["multipart/form-data"] = new OpenApiMediaType
                                {
                                    Schema = new OpenApiSchema
                                    {
                                        Type = "object",
                                        Properties = dtoType.GetProperties().ToDictionary(
                                            prop => prop.Name,
                                            prop =>
                                            {
                                                if (prop.PropertyType == typeof(IFormFile))
                                                {
                                                    return new OpenApiSchema
                                                    {
                                                        Type = "string",
                                                        Format = "binary"
                                                    };
                                                }
                                                else if (prop.PropertyType == typeof(List<IFormFile>) ||
                                                        prop.PropertyType == typeof(IEnumerable<IFormFile>))
                                                {
                                                    return new OpenApiSchema
                                                    {
                                                        Type = "array",
                                                        Items = new OpenApiSchema
                                                        {
                                                            Type = "string",
                                                            Format = "binary"
                                                        }
                                                    };
                                                }
                                                else if (prop.PropertyType == typeof(Guid) || prop.PropertyType == typeof(Guid?))
                                                {
                                                    return new OpenApiSchema { Type = "string", Format = "uuid" };
                                                }
                                                else if (prop.PropertyType == typeof(decimal) || prop.PropertyType == typeof(decimal?))
                                                {
                                                    return new OpenApiSchema { Type = "number", Format = "decimal" };
                                                }
                                                else if (prop.PropertyType == typeof(int) || prop.PropertyType == typeof(int?))
                                                {
                                                    return new OpenApiSchema { Type = "integer" };
                                                }
                                                else if (prop.PropertyType == typeof(bool) || prop.PropertyType == typeof(bool?))
                                                {
                                                    return new OpenApiSchema { Type = "boolean" };
                                                }
                                                else
                                                {
                                                    return new OpenApiSchema { Type = "string" };
                                                }
                                            }
                                        ),
                                        Required = dtoType.GetProperties()
                                            .Where(p => Attribute.IsDefined(p, typeof(System.ComponentModel.DataAnnotations.RequiredAttribute)))
                                            .Select(p => p.Name)
                                            .ToHashSet()
                                    }
                                }
                            }
                        };
                    }
                }
            }
            else
            {
                // معالجة IFormFile مباشرة في الـ parameter
                operation.RequestBody = new OpenApiRequestBody
                {
                    Content = new Dictionary<string, OpenApiMediaType>
                    {
                        ["multipart/form-data"] = new OpenApiMediaType
                        {
                            Schema = new OpenApiSchema
                            {
                                Type = "object",
                                Properties = fileParams.ToDictionary(
                                    p => p.Name,
                                    p => new OpenApiSchema
                                    {
                                        Type = "string",
                                        Format = "binary"
                                    }
                                )
                            }
                        }
                    }
                };
            }
        }
    }
}
