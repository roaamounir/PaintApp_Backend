import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const convertColor = async (req, res) => {
    try {
        const { code, systemName } = req.body;

        const colorData = await prisma.color.findFirst({
            where: {
                code: code.trim(), 
                colorSystem: {
                    name: systemName 
                }
            },
            include: {
                colorSystem: true 
            }
        });

        if (!colorData) {
            return res.status(404).json({ 
                success: false, 
                message: "عذراً، هذا الكود غير مسجل في أنظمتنا" 
            });
        }

        res.status(200).json({
            success: true,
            data: {
                code: colorData.code,
                system: colorData.colorSystem.name,
                rgb: colorData.rgb,  
                hex: colorData.hex    
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};