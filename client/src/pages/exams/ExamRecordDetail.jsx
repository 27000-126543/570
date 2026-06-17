import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Tag, Button, Space, Checkbox, Radio, Spin, message, Descriptions } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import request from '../../utils/request'

const { Group: RadioGroup } = Radio
const { Group: CheckboxGroup } = Checkbox

const typeMap = {
  single: { text: '单选题', color: 'blue' },
  multiple: { text: '多选题', color: 'purple' },
  judge: { text: '判断题', color: 'cyan' }
}

function formatUserAnswer(question, userAnswer) {
  if (userAnswer === undefined || userAnswer === null) return '未作答'
  if (question.type === 'judge') {
    const s = String(userAnswer).toLowerCase()
    if (s === 'true' || s === '正确' || s === '对') return '正确'
    if (s === 'false' || s === '错误' || s === '错') return '错误'
    return userAnswer
  }
  if (Array.isArray(userAnswer)) return userAnswer.join(',') || '未作答'
  return userAnswer || '未作答'
}

function formatCorrectAnswer(question) {
  if (question.type === 'judge') {
    const s = String(question.correct_answer || question.answer).toLowerCase()
    if (s === 'true' || s === '正确') return '正确'
    if (s === 'false' || s === '错误') return '错误'
  }
  return question.correct_answer || question.answer
}

export default function ExamRecordDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [record, setRecord] = useState(null)

  useEffect(() => {
    loadDetail()
  }, [id])

  const loadDetail = async () => {
    setLoading(true)
    try {
      const res = await request.get(`/exams/records/${id}`)
      setRecord(res.data)
    } catch (e) {
      message.error(e.message || '加载详情失败')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <Card><Spin size="large" style={{ display: 'block', margin: '60px auto' }} /></Card>
      </div>
    )
  }

  if (!record) {
    return (
      <div className="page-container">
        <Card>加载失败</Card>
      </div>
    )
  }

  const passed = !!record.passed
  const totalScore = record.exam_total_score || record.total_score || 100
  const passScore = record.exam_pass_score || record.pass_score || 60
  const displayList = record.question_details || []
  const answers = record.answers || {}
  let correctCount = 0, wrongCount = 0
  displayList.forEach(q => {
    if (q.is_correct) correctCount++; else wrongCount++
  })

  const renderOptions = (q) => {
    const question = {
      ...q,
      answer: q.correct_answer,
      options: q.options || []
    }
    const userAnswer = q.user_answer !== undefined ? q.user_answer : answers[q.id]
    const correctArr = (q.correct_answer || '').split(',').map(s => s.trim()).filter(Boolean)
    let userArr = []
    if (Array.isArray(userAnswer)) userArr = userAnswer
    else if (typeof userAnswer === 'string') userArr = userAnswer.split(/[,，\s]+/).filter(Boolean)

    if (question.type === 'judge') {
      const correctVal = String(q.correct_answer).toLowerCase()
      const userVal = String(userAnswer || '').toLowerCase()
      return (
        <RadioGroup disabled value={userVal}>
          <Space direction="vertical">
            <Radio value="true">
              正确
              {correctVal === 'true' && <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 8 }} />}
              {userVal === 'true' && correctVal !== 'true' && <CloseCircleOutlined style={{ color: '#ff4d4f', marginLeft: 8 }} />}
            </Radio>
            <Radio value="false">
              错误
              {correctVal === 'false' && <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 8 }} />}
              {userVal === 'false' && correctVal !== 'false' && <CloseCircleOutlined style={{ color: '#ff4d4f', marginLeft: 8 }} />}
            </Radio>
          </Space>
        </RadioGroup>
      )
    }

    const options = question.options || []
    if (question.type === 'single') {
      return (
        <RadioGroup disabled value={Array.isArray(userAnswer) ? userAnswer[0] : userAnswer}>
          <Space direction="vertical">
            {options.map((opt, i) => {
              const optionLabel = String.fromCharCode(65 + i)
              const isCorrectOption = correctArr.includes(optionLabel)
              const isWrongOption = userArr.includes(optionLabel) && !isCorrectOption
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
      return (
        <CheckboxGroup disabled value={userArr}>
          <Space direction="vertical">
            {options.map((opt, i) => {
              const optionLabel = String.fromCharCode(65 + i)
              const isCorrectOption = correctArr.includes(optionLabel)
              const isWrongOption = userArr.includes(optionLabel) && !isCorrectOption
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

  return (
    <div className="page-container">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/my-exams')}>返回</Button>
          <h2 className="page-title" style={{ margin: 0 }}>考试记录详情 - {record.exam_name}</h2>
        </Space>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[24, 16]}>
          <Col md={6}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 'bold', color: passed ? '#52c41a' : '#ff4d4f' }}>
                {record.score}
              </div>
              <div style={{ color: '#888', marginTop: 8 }}>得分 / {totalScore}</div>
            </div>
          </Col>
          <Col md={6}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 'bold', color: passed ? '#52c41a' : '#ff4d4f' }}>
                {passed ? '通过' : '未通过'}
              </div>
              <div style={{ color: '#888', marginTop: 8 }}>及格分：{passScore}</div>
            </div>
          </Col>
          <Col md={6}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                {correctCount}
              </div>
              <div style={{ color: '#888', marginTop: 8 }}>答对题数</div>
            </div>
          </Col>
          <Col md={6}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>
                {wrongCount}
              </div>
              <div style={{ color: '#888', marginTop: 8 }}>答错题数</div>
            </div>
          </Col>
        </Row>
        <div style={{ marginTop: 24, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="课程名称">{record.course_name}</Descriptions.Item>
            <Descriptions.Item label="用时">{record.duration_used} 分钟</Descriptions.Item>
            <Descriptions.Item label="开始时间">{record.start_time}</Descriptions.Item>
            <Descriptions.Item label="提交时间">{record.submit_time}</Descriptions.Item>
          </Descriptions>
        </div>
      </Card>

      {displayList.length === 0 ? (
        <Card><div style={{ textAlign: 'center', color: '#888', padding: '40px 0' }}>暂无答题详情</div></Card>
      ) : (
        <div>
          {displayList.map((q, i) => {
            const isCorrect = !!q.is_correct
            const userAnswer = q.user_answer !== undefined ? q.user_answer : answers[q.id]
            return (
              <Card key={q.id} style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 16 }}>
                  <Space>
                    <Tag color={typeMap[q.type]?.color}>{typeMap[q.type]?.text}</Tag>
                    <span style={{ fontWeight: 'bold' }}>第 {i + 1} 题</span>
                    <span>({q.score}分)</span>
                    {isCorrect
                      ? <Tag color="success">回答正确 +{q.score}分</Tag>
                      : <Tag color="error">回答错误 0分</Tag>
                    }
                  </Space>
                </div>
                <div style={{ fontSize: 16, marginBottom: 16, lineHeight: 1.8 }}>{q.question}</div>
                <div style={{ paddingLeft: 8 }}>{renderOptions(q)}</div>
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                  <div style={{ color: '#52c41a' }}>
                    <strong>正确答案：</strong>{formatCorrectAnswer(q)}
                  </div>
                  <div style={{ marginTop: 8, color: userAnswer === undefined || userAnswer === null || userAnswer === '' || (Array.isArray(userAnswer) && userAnswer.length === 0) ? '#ff4d4f' : '#1890ff' }}>
                    <strong>你的答案：</strong>{formatUserAnswer(q, userAnswer)}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
