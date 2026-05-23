from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Feedback


class FeedbackCreateView(APIView):
    """
    POST /api/v1/feedback/
    Submit feedback from the currently logged-in user's school.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        message = request.data.get('message', '').strip()
        if not message:
            return Response({'error': 'Message is required.'}, status=status.HTTP_400_BAD_REQUEST)

        subject = request.data.get('subject', '').strip()
        rating_raw = request.data.get('rating')
        rating = None
        if rating_raw is not None:
            try:
                rating = int(rating_raw)
                if rating not in range(1, 6):
                    rating = None
            except (TypeError, ValueError):
                rating = None

        user = request.user
        Feedback.objects.create(
            school=getattr(user, 'school', None),
            name=user.get_full_name() or user.username,
            email=user.email or '',
            subject=subject,
            message=message,
            rating=rating,
        )
        return Response({'message': 'Thank you for your feedback!'}, status=status.HTTP_201_CREATED)
