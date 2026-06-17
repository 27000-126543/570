import React, { useState, useEffect, useCallback } from 'react'
import { Card, Button, Radio, Checkbox, Space, Modal, message, Tag, Row, Col } from 'antd'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ArrowLeftOutlined, ArrowRightOutlined, SendOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import request from '../../utils/request'

const { Group: RadioGroup } = Radio
const { Group: CheckboxGroup } = Checkbox

const typeMap = {
  single: { text: '单选题', color: 'blue' },
  multiple: { text: '多选题', color: 'purple' },
  judge: { text: '判断题', color: 'green' }
}

export default function TakeExam() {
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const recordId = params.get('recordId')
  
  const [loading, setLoading] = useState(false)
  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState({})
  const [remainingTime, setRemainingTime] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState(null)
  const [currentRecordId, setCurrentRecordId] = useState(null)

  useEffect(() => {
    if (recordId) {
      loadExam()
    } else {
      message.error('参数错误，请从我的考试进入')
      navigate('/my-exams')
    }
  }, [id, recordId])

  useEffect(() => {
    if (remainingTime > 0 && !submitted) {
      const timer = setInterval(() => {
        setRemainingTime(t => {
          if (t <= 1) {
            clearInterval(timer)
            handleSubmit(true)
            return 0
          }
          return t - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [remainingTime, submitted])

  const loadExam = async () => {
    setLoading(true)
    try {
      const res = await request.get(`/exams/take/${recordId}`)
      setExam(res.data?.exam)
      setQuestions(res.data?.questions || [])
      setCurrentRecordId(res.data?.recordId)
      setRemainingTime(res.data?.exam?.duration * 60 || 0)
    } catch (e) {
      message.error(e?.message || '加载考试失败')
      navigate('/my-exams')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleAnswerChange = (questionId, value) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: value
    }))
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const isAnswered = (qid) => {
    const v = userAnswers[qid]
    if (v === undefined || v === null) return false
    if (typeof v === 'string' && !v.trim()) return false
    if (Array.isArray(v) && v.length === 0) return false
    return true
  }

  const answeredCount = () => questions.filter(q => isAnswered(q.id)).length

  const handleSubmit = useCallback(async (auto = false) => {
    if (submitted) return

    const confirmSubmit = () => {
      setSubmitted(true)
      submitAnswers()
    }

    if (auto) {
      message.warning('考试时间已到，自动交卷')
      confirmSubmit()
    } else {
      Modal.confirm({
        title: '确认交卷',
        content: `您已完成 ${answeredCount()}/${questions.length} 题，确定要交卷吗？`,
        okText: '确认交卷',
        cancelText: '继续答题',
        onOk: confirmSubmit
      })
    }
  }, [submitted, userAnswers, questions])

  const submitAnswers = async () => {
    try {
      const res = await request.post(`/exams/${id}/submit`, {
        recordId: currentRecordId,
        answers: userAnswers
      })
      setResult(res.data)
    } catch (e) {
      message.error('交卷失败')
    }
  }

  const isAnswerCorrect = (question) => {
    const userAnswer = userAnswers[question.id]
    if (!userAnswer) return false

    const correctAnswer = question.answer
    if (question.type === 'multiple') {
      const userArr = Array.isArray(userAnswer) ? userAnswer.sort() : []
      const correctArr = correctAnswer.split(',').sort()
      return JSON.stringify(userArr) === JSON.stringify(correctArr)
    }
    return userAnswer === correctAnswer
  }

  const renderOptions = (question, showResult = false) => {
    const userAnswer = userAnswers[question.id]
    const isCorrect = showResult ? isAnswerCorrect(question) : null

    if (question.type === 'judge') {
      return (
        <RadioGroup
          value={userAnswer}
          onChange={e => handleAnswerChange(question.id, e.target.value)}
          disabled={submitted}
        >
          <Space direction="vertical">
            <Radio value="true">
              正确
              {showResult && question.answer === 'true' && <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 8 }} />}
              {showResult && userAnswer === 'true' && question.answer !== 'true' && <CloseCircleOutlined style={{ color: '#ff4d4f', marginLeft: 8 }} />}
            </Radio>
            <Radio value="false">
              错误
              {showResult && question.answer === 'false' && <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 8 }} />}
              {showResult && userAnswer === 'false' && question.answer !== 'false' && <CloseCircleOutlined style={{ color: '#ff4d4f', marginLeft: 8 }} />}
            </Radio>
          </Space>
        </RadioGroup>
      )
    }

    const options = question.options || []
    if (question.type === 'single') {
      return (
        <RadioGroup
          value={userAnswer}
          onChange={e => handleAnswerChange(question.id, e.target.value)}
          disabled={submitted}
        >
          <Space direction="vertical">
            {options.map((opt, i) => {
              const optionLabel = String.fromCharCode(65 + i)
              const isCorrectOption = showResult && question.answer === optionLabel
              const isWrongOption = showResult && userAnswer === optionLabel && question.answer !== optionLabel
              return (
                <Radio key={i} value={optionLabel}>
                  {optionLabel}. {opt}
                  {isCorrectOption && <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 8 }} />}
                  {isWrongOption && <CloseCircleOutlined style={{ color: '#ff4d4f', marginLeft: 8 }} />}
                </Radio>
              )
            })}
          </Space>
        </RadioGroup>
      )
    }

    if (question.type === 'multiple') {
      const correctAnswers = question.answer.split(',')
      return (
        <CheckboxGroup
          value={userAnswer || []}
          onChange={values => handleAnswerChange(question.id, values)}
          disabled={submitted}
        >
          <Space direction="vertical">
            {options.map((opt, i) => {
              const optionLabel = String.fromCharCode(65 + i)
              const isCorrectOption = showResult && correctAnswers.includes(optionLabel)
              const isWrongOption = showResult && (userAnswer || []).includes(optionLabel) && !correctAnswers.includes(optionLabel)
              return (
                <Checkbox key={i} value={optionLabel}>
                  {optionLabel}. {opt}
                  {isCorrectOption && <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 8 }} />}
                  {isWrongOption && <CloseCircleOutlined style={{ color: '#ff4d4f', marginLeft: 8 }} />}
                </Checkbox>
              )
            })}
          </Space>
        </CheckboxGroup>
      )
    }

    return null
  }

  const renderQuestion = (question, index, showResult = false) => {
    return (
      <Card key={question.id} style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Tag color={typeMap[question.type]?.color}>{typeMap[question.type]?.text}</Tag>
            <span style={{ fontWeight: 'bold' }}>第 {index + 1} 题</span>
            <span>({question.score}分)</span>
            {showResult && (
              isAnswerCorrect(question)
                ? <Tag color="success">回答正确 +{question.score}分</Tag>
                : <Tag color="error">回答错误 0分</Tag>
            )}
          </Space>
        </div>
        <div style={{ fontSize: 16, marginBottom: 16, lineHeight: 1.8 }}>
          {question.question}
        </div>
        <div style={{ paddingLeft: 8 }}>
          {renderOptions(question, showResult)}
        </div>
        {showResult && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
            <div style={{ color: '#52c41a' }}>
              <strong>正确答案：</strong>
              {question.type === 'judge'
                ? (question.answer === 'true' ? '正确' : '错误')
                : question.answer
              }
            </div>
            <div style={{ marginTop: 8, color: userAnswers[question.id] ? '#1890ff' : '#ff4d4f' }}>
              <strong>你的答案：</strong>
              {question.type === 'judge'
                ? (userAnswers[question.id] === 'true' ? '正确' : userAnswers[question.id] === 'false' ? '错误' : '未作答')
                : (Array.isArray(userAnswers[question.id]) ? userAnswers[question.id].join(',') : userAnswers[question.id] || '未作答')
              }
            </div>
          </div>
        )}
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="page-container">
        <Card loading={true} />
      </div>
    )
  }

  if (submitted && result) {
    const passed = !!result.passed
    const displayList = result.question_details || questions
    return (
      <div className="page-container">
        <div className="page-header">
          <h2 className="page-title">考试结果 - {exam?.name}</h2>
          <Button onClick={() => navigate('/my-exams')}>返回我的考试</Button>
        </div>

        <Card style={{ marginBottom: 24 }}>
          <Row gutter={24}>
            <Col md={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, fontWeight: 'bold', color: passed ? '#52c41a' : '#ff4d4f' }}>
                  {result.score}
                </div>
                <div style={{ color: '#888', marginTop: 8 }}>得分 / {result.total_score || exam.total_score}</div>
              </div>
            </Col>
            <Col md={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, fontWeight: 'bold', color: passed ? '#52c41a' : '#ff4d4f' }}>
                  {passed ? '通过' : '未通过'}
                </div>
                <div style={{ color: '#888', marginTop: 8 }}>及格分：{result.pass_score || exam.pass_score}</div>
              </div>
            </Col>
            <Col md={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                  {result.correct_count}
                </div>
                <div style={{ color: '#888', marginTop: 8 }}>答对题数</div>
              </div>
            </Col>
            <Col md={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>
                  {result.wrong_count}
                </div>
                <div style={{ color: '#888', marginTop: 8 }}>答错题数</div>
              </div>
            </Col>
          </Row>
        </Card>

        <div>
          {displayList.map((q, i) => {
            const qu = {
              id: q.id,
              type: q.type,
              question: q.question,
              options: q.options,
              answer: q.correct_answer,
              score: q.score
            }
            const ua = { ...userAnswers }
            if (q.user_answer !== undefined) ua[q.id] = q.user_answer
            const oldUa = { ...userAnswers }
            Object.assign(userAnswers, ua)
            const node = renderQuestion(qu, i, true)
            Object.assign(userAnswers, oldUa)
            return node
          })}
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentIndex]

  return (
    <div className="page-container">
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: '#fff',
        padding: '16px 24px',
        borderBottom: '1px solid #f0f0f0',
        marginBottom: 24
      }}>
        <Row align="middle">
          <Col md={16}>
            <h2 className="page-title" style={{ margin: 0 }}>{exam?.name}</h2>
            <div style={{ color: '#888', marginTop: 8 }}>
              <Space>
                <span>课程：{exam?.course_name}</span>
                <span>总分：{exam?.total_score}</span>
                <span>及格分：{exam?.pass_score}</span>
                <span>共 {questions.length} 题</span>
              </Space>
            </div>
          </Col>
          <Col md={8} style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#ff4d4f' }}>
              {formatTime(remainingTime)}
            </div>
            <div style={{ color: '#888' }}>剩余时间</div>
          </Col>
        </Row>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {currentQuestion && renderQuestion(currentQuestion, currentIndex)}

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={handlePrev}
              disabled={currentIndex === 0}
            >
              上一题
            </Button>
            <span style={{ padding: '0 16px' }}>
              {currentIndex + 1} / {questions.length}
            </span>
            <Button
              icon={<ArrowRightOutlined />}
              onClick={handleNext}
              disabled={currentIndex === questions.length - 1}
            >
              下一题
            </Button>
            <Button
              type="primary"
              danger
              icon={<SendOutlined />}
              onClick={() => handleSubmit(false)}
            >
              交卷
            </Button>
          </Space>
        </div>

        <div style={{ marginTop: 32, padding: 16, background: '#fafafa', borderRadius: 8 }}>
          <div style={{ marginBottom: 12, fontWeight: 'bold' }}>答题卡</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {questions.map((q, i) => (
              <Button
                key={q.id}
                type={currentIndex === i ? 'primary' : isAnswered(q.id) ? 'default' : 'dashed'}
                style={{
                  width: 40,
                  height: 40,
                  padding: 0,
                  borderColor: isAnswered(q.id) ? '#52c41a' : undefined,
                  color: isAnswered(q.id) ? '#52c41a' : undefined
                }}
                onClick={() => setCurrentIndex(i)}
              >
                {i + 1}
              </Button>
            ))}
          </div>
          <div style={{ marginTop: 12, color: '#888', fontSize: 12 }}>
            <Space>
              <span><Button type="primary" size="small" style={{ marginRight: 4 }} />当前题</span>
              <span><Button style={{ borderColor: '#52c41a', color: '#52c41a', marginRight: 4 }} size="small" />已作答</span>
              <span><Button type="dashed" size="small" style={{ marginRight: 4 }} />未作答</span>
            </Space>
          </div>
        </div>
      </div>
    </div>
  )
}
