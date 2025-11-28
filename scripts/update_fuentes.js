import turso from "../src/config/turso.js";
import "dotenv/config";

const updateFuentes = async () => {
  try {
    const mapeo = {
      lista: "Response.Articulos",
      id: "CodigoProducto", // CORREGIDO
      titulo: "Nombre",
      descripcion: "Descripcion",
      precio_oferta: "PrecioOferta",
      precio_normal: "PrecioNormal",
      imagen: "UrlImagen",
      categoria: "Categoria",
      enlace: "https://guatemaladigital.com/Producto/",
    };

    await turso.execute({
      sql: "UPDATE Fuentes SET mapeo_campos = ? WHERE nombre = 'GuatemalaDigital'",
      args: [JSON.stringify(mapeo)],
    });
    console.log("Fuente GuatemalaDigital actualizada.");
  } catch (error) {
    console.error(error);
  }
};

updateFuentes();
