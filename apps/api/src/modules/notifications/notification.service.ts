import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import axios from 'axios';

interface SendNotificationDto {
  recipientPhone: string;
  message: string;
  tenantId: string;
  workOrderId?: string;
  type: string;
  channel?: 'WHATSAPP' | 'SMS';
}

export class NotificationService {
  async sendWorkOrderNotification(workOrder: any, type: string) {
    if (!workOrder.customer?.phone) return;

    const message = this.buildMessage(workOrder, type);
    if (!message) return;

    await this.send({
      recipientPhone: workOrder.customer.phone,
      message,
      tenantId: workOrder.tenantId,
      workOrderId: workOrder.id,
      type,
      channel: 'WHATSAPP',
    });
  }

  async send(data: SendNotificationDto) {
    const { recipientPhone, message, tenantId, workOrderId, type, channel = 'WHATSAPP' } = data;

    // Save notification to DB
    const notification = await prisma.notification.create({
      data: {
        tenantId,
        workOrderId,
        recipientPhone,
        channel,
        type,
        message,
        status: 'PENDING',
      },
    });

    try {
      if (channel === 'WHATSAPP' && env.ULTRAMSG_INSTANCE_ID && env.ULTRAMSG_TOKEN) {
        await this.sendWhatsApp(recipientPhone, message);
      }

      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
    } catch (error: any) {
      logger.error('Notification send failed: %s', error?.message || String(error));
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'FAILED', failureReason: error?.message || String(error) },
      });
    }
  }

  private async sendWhatsApp(phone: string, message: string) {
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://api.ultramsg.com/${env.ULTRAMSG_INSTANCE_ID}/messages/chat`;

    await axios.post(url, {
      token: env.ULTRAMSG_TOKEN,
      to: cleanPhone,
      body: message,
    });
  }

  private buildMessage(workOrder: any, type: string): string {
    const { orderNumber, vehicle, customer, trackingToken } = workOrder;
    const trackingUrl = `${env.FRONTEND_URL}/track/${trackingToken}`;
    const vehicleInfo = `${vehicle?.make} ${vehicle?.model} (${vehicle?.plateNumber})`;
    const customerName = customer?.name || 'العميل';

    const messages: Record<string, string> = {
      WORK_ORDER_RECEIVED: `مرحباً ${customerName} 👋\n\nتم استلام سيارتكم ${vehicleInfo} بنجاح ✅\n\nرقم طلب الخدمة: ${orderNumber}\n\nيمكنكم متابعة حالة السيارة عبر الرابط:\n${trackingUrl}`,

      DIAGNOSIS_STARTED: `مرحباً ${customerName} 🔧\n\nبدأ فريقنا الفني بتشخيص سيارتكم ${vehicleInfo}\n\nرقم الطلب: ${orderNumber}\n\nسيتم إعلامكم بعرض السعر قريباً.`,

      QUOTE_READY: `مرحباً ${customerName} 📋\n\nعرض السعر الخاص بسيارتكم ${vehicleInfo} جاهز!\n\nرقم الطلب: ${orderNumber}\n\nيرجى مراجعة العرض والموافقة عليه من الرابط:\n${trackingUrl}\n\nبانتظار موافقتكم 🙏`,

      WORK_STARTED: `مرحباً ${customerName} ⚙️\n\nبدأ العمل على سيارتكم ${vehicleInfo}\n\nرقم الطلب: ${orderNumber}\n\nتابعوا التقدم: ${trackingUrl}`,

      VEHICLE_READY: `مرحباً ${customerName} 🎉\n\nسيارتكم ${vehicleInfo} جاهزة للاستلام!\n\nرقم الطلب: ${orderNumber}\n\nنحن بانتظاركم خلال أوقات العمل. شكراً لثقتكم بنا 🙏`,

      VEHICLE_DELIVERED: `مرحباً ${customerName} ✅\n\nتم تسليم سيارتكم ${vehicleInfo} بنجاح.\n\nنتمنى لكم قيادة آمنة! 🚗\n\nشكراً لاختياركم لنا.`,
    };

    return messages[type] || '';
  }
}

export const notificationService = new NotificationService();
